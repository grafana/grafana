import { createRoot, type Root } from 'react-dom/client';

import { dateTime, rangeUtil, type DataFrame, type GrafanaTheme2, type TimeRange } from '@grafana/data';

import { type EmbedDataProvider, staticDataProvider } from './data/types';
import { normalizePanel, type EmbedPanel, type EmbedPanelInput } from './panel/normalize';
import { EmbedPanelHost } from './render/EmbedPanelHost';
import { initEmbedRegistries } from './render/registries';
import { registerShadowRoot, unregisterShadowRoot, setShadowTheme } from './styles/shadowStyles';
import { resolveThemeMode, themeFromCssVars } from './theme/fromCssVars';

// Must run before anything reads the standard field config or editor registries:
// Registry.setInit throws once a registry has been read, so deferring this to
// connectedCallback would turn any earlier read into a hard mount failure. Module
// scope here (rather than in index.ts) also covers consumers importing the element
// directly.
initEmbedRegistries();

const DEFAULT_HEIGHT = 240;
const DEFAULT_FROM = 'now-6h';
const DEFAULT_TO = 'now';

/**
 * `<grafana-panel>`: one Grafana panel as a portable custom element.
 *
 * Deliberately renders the panel body only. Grafana's own TimeRangePicker and
 * RefreshPicker emit legacy class names served by the app's global SCSS bundle, which
 * an embed will never ship, and time range is a host concern anyway: the host sets it
 * through attributes and hears about user-driven changes through the
 * `timerangechange` event. That is also what lets one host control drive several
 * panels at once.
 */
/*
 * A custom element has to be a class. This extends HTMLElement so
 * customElements.define can register it; it is not a React component, which is what
 * the rule below is actually looking for.
 */
// eslint-disable-next-line react-prefer-function-component/react-prefer-function-component
export class GrafanaPanelElement extends HTMLElement {
  static get observedAttributes() {
    return ['from', 'to', 'theme', 'time-zone', 'height'];
  }

  private shadow: ShadowRoot;
  private mount: HTMLDivElement;
  private reactRoot: Root | undefined;
  private resizeObserver: ResizeObserver | undefined;
  private themeMedia: MediaQueryList | undefined;
  private connected = false;

  private panelInput: EmbedPanelInput | undefined;
  private normalized: EmbedPanel | undefined;
  private provider: EmbedDataProvider | undefined;
  private framesInput: DataFrame[] | undefined;
  private theme: GrafanaTheme2 | undefined;
  private width = 0;
  private refreshNonce = 0;

  constructor() {
    super();
    // Open rather than closed: hosts and test tooling need to be able to look inside,
    // and isolation comes from the boundary, not from hiding it.
    this.shadow = this.attachShadow({ mode: 'open' });
    this.mount = document.createElement('div');
    this.mount.style.width = '100%';
    this.shadow.appendChild(this.mount);
  }

  /** Dashboard v2 `PanelKind`, or classic v1 panel JSON. */
  get panel(): EmbedPanelInput | undefined {
    return this.panelInput;
  }
  set panel(value: EmbedPanelInput | undefined) {
    this.panelInput = value;
    this.normalized = normalizePanel(value);
    this.render();
  }

  /** The host's data source of record. Overrides `frames`. */
  get dataProvider(): EmbedDataProvider | undefined {
    return this.provider;
  }
  set dataProvider(value: EmbedDataProvider | undefined) {
    this.provider = value;
    // An explicit provider supersedes any frames set earlier, so `frames` must not
    // keep reporting data the element is no longer showing.
    this.framesInput = undefined;
    this.render();
  }

  /** Convenience for hosts that already hold frames and need no re-query. */
  get frames(): DataFrame[] | undefined {
    return this.framesInput;
  }
  set frames(value: DataFrame[] | undefined) {
    this.framesInput = value;
    this.provider = value ? staticDataProvider(value) : undefined;
    this.render();
  }

  /**
   * Recomputes the theme from current CSS custom properties. Hosts call this when
   * their own tokens change; in an MCP App that is the hostcontextchanged handler.
   */
  refreshTheme() {
    this.theme = undefined;
    this.render();
  }

  connectedCallback() {
    this.connected = true;

    this.resizeObserver = new ResizeObserver(() => {
      const next = this.clientWidth;
      if (next !== this.width) {
        this.width = next;
        this.render();
      }
    });
    this.resizeObserver.observe(this);
    this.width = this.clientWidth;

    if (window.matchMedia) {
      this.themeMedia = window.matchMedia('(prefers-color-scheme: dark)');
      this.themeMedia.addEventListener('change', this.onSystemThemeChange);
    }

    this.render();
  }

  disconnectedCallback() {
    this.connected = false;
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.themeMedia?.removeEventListener('change', this.onSystemThemeChange);
    this.themeMedia = undefined;
    unregisterShadowRoot(this.shadow);
    this.reactRoot?.unmount();
    this.reactRoot = undefined;
  }

  attributeChangedCallback(name: string) {
    if (name === 'theme') {
      this.theme = undefined;
    }
    this.render();
  }

  private onSystemThemeChange = () => {
    if (!this.getAttribute('theme')) {
      this.theme = undefined;
      this.render();
    }
  };

  private rawRange(): { from: string; to: string } {
    return {
      from: this.getAttribute('from') ?? DEFAULT_FROM,
      to: this.getAttribute('to') ?? DEFAULT_TO,
    };
  }

  /**
   * Deliberately resolved fresh on every render rather than memoized.
   *
   * GraphNG only rebuilds its uPlot config when its props change, so handing it a
   * referentially stable PanelData and TimeRange leaves the plot area empty: the
   * legend and layout render, uPlot never initializes. Consumers that need a stable
   * identity for the *window* should use the raw range instead, which is what
   * EmbedPanelHost keys its data subscription on.
   */
  private timeRange(): TimeRange {
    const { from, to } = this.rawRange();
    return rangeUtil.convertRawToRange({ from: numericOrRaw(from), to: numericOrRaw(to) });
  }

  /**
   * Re-runs the data subscription against the current clock. This is what a host's
   * refresh control calls; a relative range such as `now-1h` otherwise only
   * re-queries when the range itself changes.
   */
  refresh() {
    this.refreshNonce++;
    this.render();
  }

  private currentTheme(): GrafanaTheme2 {
    if (!this.theme) {
      const mode = resolveThemeMode(this, this.getAttribute('theme'));
      this.theme = themeFromCssVars(this, mode);
    }
    return this.theme;
  }

  private render() {
    if (!this.connected) {
      return;
    }

    const theme = this.currentTheme();
    // Styles must be in the shadow root before React commits, or the first paint is
    // unstyled: emotion writes to document.head, which a shadow root cannot see.
    registerShadowRoot(this.shadow, theme);
    setShadowTheme(theme);

    if (!this.normalized) {
      this.reactRoot?.unmount();
      this.reactRoot = undefined;
      this.mount.textContent = '';
      return;
    }

    this.reactRoot ??= createRoot(this.mount);
    this.reactRoot.render(
      <EmbedPanelHost
        panel={this.normalized}
        provider={this.provider}
        theme={theme}
        timeRange={this.timeRange()}
        rawRange={this.rawRange()}
        refreshNonce={this.refreshNonce}
        width={this.width || this.clientWidth || 0}
        height={Number(this.getAttribute('height')) || DEFAULT_HEIGHT}
        timeZone={this.getAttribute('time-zone') ?? 'browser'}
        onChangeTimeRange={this.emitTimeRangeChange}
      />
    );
  }

  private emitTimeRangeChange = (fromMs: number, toMs: number) => {
    this.dispatchEvent(
      new CustomEvent('timerangechange', {
        detail: { from: fromMs, to: toMs },
        bubbles: true,
        composed: true,
      })
    );
  };
}

/**
 * Agent hosts overwhelmingly pass epoch ms, while Grafana's raw ranges take a
 * DateTime or a relative expression such as 'now-6h'. Accept both.
 */
function numericOrRaw(value: string) {
  return /^\d+$/.test(value) ? dateTime(Number(value)) : value;
}

export const ELEMENT_NAME = 'grafana-panel';

export function defineGrafanaPanel(name = ELEMENT_NAME) {
  if (typeof customElements === 'undefined' || customElements.get(name)) {
    return;
  }
  customElements.define(name, GrafanaPanelElement);
}

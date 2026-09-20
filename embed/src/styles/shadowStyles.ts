import uplotLayoutCss from 'uplot/dist/uPlot.min.css?inline';

import { colorManipulator, type GrafanaTheme2 } from '@grafana/data';
// uPlot's own layout CSS. grafana-ui imports this as a side effect in
// components/uPlot/Plot.tsx and webpack extracts it into the app's global <link>;
// without it the chart has no layout at all. ?inline gives us the text so it can be
// adopted into a shadow root instead of leaking into the host document.

/**
 * Grafana's UI is styled by the @emotion/css module singleton, whose sheet container
 * is hard-defaulted to document.head. 268 files in grafana-ui import `css` from it at
 * module scope and useStyles2 only memoizes, so there is no cache to retarget and no
 * hook point to add one.
 *
 * So we invert the problem: let emotion keep writing to document.head, and mirror
 * those rules into a constructed stylesheet that every shadow root adopts. One sheet
 * is shared by all roots. This needs no change to grafana-ui.
 */

const supportsConstructed =
  typeof CSSStyleSheet !== 'undefined' &&
  'replaceSync' in CSSStyleSheet.prototype &&
  typeof document !== 'undefined' &&
  'adoptedStyleSheets' in Document.prototype;

interface RootEntry {
  root: ShadowRoot;
  /** Fallback <style> nodes for browsers without constructable stylesheets. */
  emotionFallback?: HTMLStyleElement;
  baseFallback?: HTMLStyleElement;
}

const roots = new Map<ShadowRoot, RootEntry>();

let emotionSheet: CSSStyleSheet | undefined;
let baseSheet: CSSStyleSheet | undefined;
let lastEmotionSignature = '';
let lastBaseCss = '';
let observer: MutationObserver | undefined;

function emotionTags(): HTMLStyleElement[] {
  return Array.from(document.head.querySelectorAll<HTMLStyleElement>('style[data-emotion]'));
}

/**
 * Emotion runs in speedy mode under NODE_ENV=production, so its <style> tags are
 * empty and the rules live in sheet.cssRules. It keeps up to 65000 rules per tag, so
 * new rules usually mutate an existing sheet without touching the DOM. Rule counts
 * are therefore the cheap change signal, not DOM mutations.
 */
function emotionSignature(tags: HTMLStyleElement[]): string {
  return tags.map((tag) => tag.sheet?.cssRules.length ?? tag.textContent?.length ?? 0).join(',');
}

function readEmotionCss(tags: HTMLStyleElement[]): string {
  const parts: string[] = [];
  for (const tag of tags) {
    const sheet = tag.sheet;
    if (!sheet) {
      parts.push(tag.textContent ?? '');
      continue;
    }
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        parts.push(rule.cssText);
      }
    } catch {
      // Cross-origin sheets are unreadable; the text node is the best we can do.
      parts.push(tag.textContent ?? '');
    }
  }
  return parts.join('\n');
}

/**
 * What GlobalStyles provides at document level and a shadow root cannot inherit.
 *
 * The box-sizing pair is the one that fails silently and matters most: GlobalStyles
 * sets `box-sizing: inherit` on `*` and `border-box` on `html`, and a shadow root has
 * no `html`, so every component would otherwise fall back to content-box.
 *
 * The uPlot rules are ported from grafana-ui's themes/GlobalStyles/uPlot.ts, which is
 * an @emotion/react Global block and so cannot be read back as text.
 */
function buildBaseCss(theme: GrafanaTheme2): string {
  const crosshair = theme.colors.text.secondary;
  return `
:host {
  display: block;
  box-sizing: border-box;
  color-scheme: ${theme.colors.mode};
  color: ${theme.colors.text.primary};
  font-family: ${theme.typography.fontFamily};
  font-size: ${theme.typography.fontSize}px;
  line-height: ${theme.typography.body.lineHeight};
  -webkit-font-smoothing: antialiased;
}
*, *::before, *::after { box-sizing: border-box; }
.uplot { font-family: inherit; }
.u-select {
  background: ${colorManipulator.alpha(theme.colors.text.primary, 0.2)};
  box-shadow: inset 0 0 0 1px ${crosshair};
}
.u-over.zoom-drag { cursor: zoom-in; }
.u-hz .u-cursor-x, .u-vt .u-cursor-y { border-right: 1px dashed ${crosshair}; }
.u-hz .u-cursor-y, .u-vt .u-cursor-x { border-bottom: 1px dashed ${crosshair}; }
.shared-crosshair:not(.plot-active) .u-cursor-pt { display: none !important; }
${uplotLayoutCss}
`;
}

function applyToRoot(entry: RootEntry) {
  if (supportsConstructed && emotionSheet && baseSheet) {
    entry.root.adoptedStyleSheets = [baseSheet, emotionSheet];
    return;
  }
  if (!entry.baseFallback) {
    entry.baseFallback = document.createElement('style');
    entry.root.prepend(entry.baseFallback);
  }
  if (!entry.emotionFallback) {
    entry.emotionFallback = document.createElement('style');
    entry.root.prepend(entry.emotionFallback);
  }
  entry.baseFallback.textContent = lastBaseCss;
  entry.emotionFallback.textContent = readEmotionCss(emotionTags());
}

/**
 * Re-reads emotion's output and pushes it into every registered shadow root.
 *
 * Call after each render: emotion inserts rules while components render, and it does
 * so without DOM mutations, so a post-render sync is the reliable trigger.
 */
export function syncShadowStyles() {
  if (roots.size === 0) {
    return;
  }
  const tags = emotionTags();
  const signature = emotionSignature(tags);
  if (signature === lastEmotionSignature) {
    return;
  }
  lastEmotionSignature = signature;

  if (supportsConstructed) {
    emotionSheet ??= new CSSStyleSheet();
    emotionSheet.replaceSync(readEmotionCss(tags));
    return;
  }
  for (const entry of roots.values()) {
    applyToRoot(entry);
  }
}

/** Rebuilds the theme-dependent base sheet. Cheap and idempotent. */
export function setShadowTheme(theme: GrafanaTheme2) {
  const css = buildBaseCss(theme);
  if (css === lastBaseCss) {
    return;
  }
  lastBaseCss = css;
  if (supportsConstructed) {
    baseSheet ??= new CSSStyleSheet();
    baseSheet.replaceSync(css);
    return;
  }
  for (const entry of roots.values()) {
    applyToRoot(entry);
  }
}

export function registerShadowRoot(root: ShadowRoot, theme: GrafanaTheme2) {
  if (roots.has(root)) {
    return;
  }
  const entry: RootEntry = { root };
  roots.set(root, entry);

  setShadowTheme(theme);
  // Force a first read regardless of signature.
  lastEmotionSignature = '';
  syncShadowStyles();
  applyToRoot(entry);

  // New emotion tags do appear when a sheet fills up, and other code can inject into
  // head at any time, so watch for added nodes as well as syncing after render.
  if (!observer) {
    observer = new MutationObserver(() => {
      lastEmotionSignature = '';
      syncShadowStyles();
    });
    observer.observe(document.head, { childList: true });
  }
}

export function unregisterShadowRoot(root: ShadowRoot) {
  roots.delete(root);
  if (roots.size === 0 && observer) {
    observer.disconnect();
    observer = undefined;
  }
}

/**
 * @font-face is ignored inside a shadow root by spec, so Grafana's font rules have to
 * live in the host document. GlobalStyles builds its URLs from the global
 * window.__grafana_public_path__; a host that serves no Grafana assets should instead
 * supply fonts itself (in an MCP App, via the SDK's applyHostFonts).
 */
export function installFonts(css: string, id = 'grafana-embed-fonts') {
  if (typeof document === 'undefined' || document.getElementById(id)) {
    return;
  }
  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
}

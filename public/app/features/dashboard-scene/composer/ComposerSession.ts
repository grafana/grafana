import { ClientProviderEvents } from '@openfeature/web-sdk';

import { t } from '@grafana/i18n';
import { getFeatureFlagClient } from '@grafana/runtime/internal';
import { sceneGraph, VizPanel, type SceneObject } from '@grafana/scenes';
import { appEvents } from 'app/core/app_events';
import { SetExtensionSidebarPresentationEvent } from 'app/types/events';

import { applyDashboardSpec } from '../actions/dashboard/applyDashboardSpec';
import type { DashboardScene } from '../scene/DashboardScene';
import { dashboardComposerEnabled } from '../scene/dashboardModes';
import { TabItem } from '../scene/layout-tabs/TabItem';
import { transformSceneToSaveModelSchemaV2 } from '../serialization/transformSceneToSaveModelSchemaV2';
import { DashboardStateChangedEvent } from '../sidebar/events';
import { isRepeatCloneOrChildOf } from '../utils/clone';
import { getPanelIdForVizPanel } from '../utils/utils-panels';
import { dashboardV2SpecSchema } from '../v2schema/dashboardV2Schema';

import { canEnterComposer, canStillEdit } from './composerAccess';
import {
  type ApplyOutcome,
  type ComposerAnnotation,
  type ComposerDashboardSpec,
  type ComposerElement,
  type ComposerSessionAPI,
  type ElementPick,
  type ElementPoint,
  type ElementRef,
  type RegionPick,
} from './types';

/** What the overlay renders. A new object on every change, for `useSyncExternalStore`. */
export interface ComposerOverlayState {
  picking: boolean;
  paused: boolean;
  highlight: ElementRef | null;
  annotations: ComposerAnnotation[];
  /** Bumps when the dashboard definition changes, so the overlay re-measures. */
  layoutTick: number;
}

const INITIAL_OVERLAY_STATE: ComposerOverlayState = {
  picking: false,
  paused: false,
  highlight: null,
  annotations: [],
  layoutTick: 0,
};

const ORIGIN: ElementPoint = { x: 0, y: 0 };

/**
 * One Composer session, bound to the dashboard it was entered on. Writes go to that scene only,
 * never to whichever mutation client is newest on the global stack (that can be a notebook).
 *
 * `revision` increases on every definition change, whatever its source: this session's applies, and
 * every edit action, undo or redo the dashboard records. A write prepared against an older revision is
 * refused, so Assistant never overwrites a change it has not read.
 */
export class ComposerSession implements ComposerSessionAPI {
  public readonly dashboardUid: string;

  private readonly controller = new AbortController();
  private revision = 0;
  private applying = false;
  private closed = false;
  private pendingPick?: (pick: ElementPick | null) => void;
  private overlayState: ComposerOverlayState = INITIAL_OVERLAY_STATE;
  private readonly listeners = new Set<() => void>();
  private readonly annotationListeners = new Set<(id: string) => void>();
  private readonly annotationHoverListeners = new Set<(id: string | null) => void>();
  /** Containers the plugin portals into, kept across re-renders and moved with the overlay. */
  private readonly anchors = new Map<string, HTMLDivElement>();
  private anchorHost: HTMLElement | null = null;
  private requestMeasure?: () => void;
  private readonly cleanups: Array<() => void> = [];

  /** Enters Composer on `scene`. Throws when it cannot, with the reason `canEnterComposer` gives. */
  public static enter(scene: DashboardScene | null): ComposerSession {
    const check = canEnterComposer(scene);
    if (!check.ok || !scene) {
      throw new Error(`Composer is not available: ${check.ok ? 'not_dashboard' : check.reason}`);
    }
    const session = new ComposerSession(scene);
    if (!scene.enterComposerMode(session)) {
      throw new Error('Composer is not available: unsupported');
    }
    session.start();
    return session;
  }

  private constructor(private readonly scene: DashboardScene) {
    this.dashboardUid = scene.state.uid ?? '';
  }

  public get signal(): AbortSignal {
    return this.controller.signal;
  }

  private start() {
    const stateChanged = this.scene.subscribeToEvent(DashboardStateChangedEvent, () => {
      if (!this.applying) {
        this.revision++;
        this.setOverlayState({ layoutTick: this.overlayState.layoutTick + 1 });
      }
    });
    this.cleanups.push(() => stateChanged.unsubscribe());

    // Turning the flag off ends the session; unsaved edits stay.
    const client = getFeatureFlagClient();
    const onFlagsChanged = () => {
      if (!dashboardComposerEnabled()) {
        this.exit();
      }
    };
    client.addHandler(ClientProviderEvents.ConfigurationChanged, onFlagsChanged);
    this.cleanups.push(() => client.removeHandler(ClientProviderEvents.ConfigurationChanged, onFlagsChanged));

    appEvents.publish(new SetExtensionSidebarPresentationEvent({ presentation: 'floating' }));
  }

  public pickElement(signal: AbortSignal): Promise<ElementPick | null> {
    this.cancelPick();
    if (this.closed || this.overlayState.paused || signal.aborted) {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      const onAbort = () => this.completePick(null);
      signal.addEventListener('abort', onAbort, { once: true });
      this.pendingPick = (pick) => {
        signal.removeEventListener('abort', onAbort);
        resolve(pick);
      };
      this.setOverlayState({ picking: true });
    });
  }

  public pickRegion(_signal: AbortSignal, _start?: PointerEvent): Promise<RegionPick | null> {
    return Promise.resolve(null);
  }

  public listElements(): ComposerElement[] {
    return [];
  }

  public highlight(target: ElementRef | null): void {
    if (!this.closed) {
      this.setOverlayState({ highlight: target });
    }
  }

  public setPaused(paused: boolean): void {
    if (this.closed) {
      return;
    }
    if (paused) {
      this.cancelPick();
    }
    this.setOverlayState({ paused });
  }

  public setAnnotations(items: ComposerAnnotation[]): void {
    if (this.closed) {
      return;
    }
    const annotations = items.map(({ id, ref, point, label, state }) => ({
      id,
      ref: { ...ref },
      point: { x: clamp01(point.x), y: clamp01(point.y) },
      label: label.slice(0, 3),
      state,
    }));
    const ids = new Set(annotations.map(({ id }) => id));
    for (const [id, anchor] of this.anchors) {
      if (!ids.has(id)) {
        anchor.remove();
        this.anchors.delete(id);
      }
    }
    this.setOverlayState({ annotations });
  }

  public onAnnotationClick(listener: (id: string) => void): () => void {
    this.annotationListeners.add(listener);
    return () => this.annotationListeners.delete(listener);
  }

  public onAnnotationHover(listener: (id: string | null) => void): () => void {
    this.annotationHoverListeners.add(listener);
    return () => this.annotationHoverListeners.delete(listener);
  }

  public getAnnotationAnchor(id: string): HTMLElement | null {
    const item = this.findAnnotation(id);
    if (this.closed || !item || !this.findElementRoot(item.ref)) {
      return null;
    }
    let anchor = this.anchors.get(id);
    if (!anchor) {
      anchor = document.createElement('div');
      anchor.dataset.composerAnnotationAnchor = id;
      // Zero-sized so the plugin's content lays itself out from this point; the overlay sets left/top.
      Object.assign(anchor.style, { position: 'absolute', width: '0', height: '0', pointerEvents: 'auto' });
      this.anchors.set(id, anchor);
      this.anchorHost?.appendChild(anchor);
      this.requestMeasure?.();
    }
    return anchor;
  }

  public revealAnnotation(id: string): void {
    const item = this.findAnnotation(id);
    const panel = item?.ref.kind === 'panel' ? this.findPanel(item.ref.panelId) : undefined;
    const element = item ? this.findElementRoot(item.ref) : null;
    if (this.closed || !item || !panel || !element || isInHiddenTab(panel)) {
      return;
    }
    const behavior: ScrollBehavior = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      ? 'auto'
      : 'smooth';
    const container = getScrollContainer(element);
    const visible = getVisibleBounds(container);
    const rect = element.getBoundingClientRect();
    if (rect.height <= visible.bottom - visible.top) {
      // The whole element fits, so the pin's point is visible once the element is.
      element.scrollIntoView({ behavior, block: 'nearest', inline: 'nearest' });
      return;
    }
    // Taller than the visible area: centre the pin's point instead.
    const pointY = rect.top + item.point.y * rect.height;
    container.scrollBy({ top: pointY - (visible.top + visible.bottom) / 2, behavior });
  }

  public async readSpec(): Promise<{ spec: ComposerDashboardSpec; revision: number }> {
    if (this.closed) {
      throw new Error('The Composer session has ended.');
    }
    return { spec: transformSceneToSaveModelSchemaV2(this.scene), revision: this.revision };
  }

  public async applySpec(
    spec: ComposerDashboardSpec,
    { signal, baseRevision }: { signal: AbortSignal; baseRevision: number }
  ): Promise<ApplyOutcome> {
    // 1. Prepare. Everything awaited or fallible-without-writing happens here.
    const parsed = dashboardV2SpecSchema.safeParse(spec);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => {
        const path = issue.path.join('.');
        return path ? `${path}: ${issue.message}` : issue.message;
      });
      return { status: 'invalid', message: `Validation failed: ${issues.join(', ')}` };
    }
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the parsed output is the v2 spec the transform expects
    const validSpec = parsed.data as unknown as ComposerDashboardSpec;

    // 2. Gate, synchronously: nothing below this line awaits, so nothing can run between the checks
    // and the write.
    const refusal = this.checkWrite(signal, baseRevision);
    if (refusal) {
      return refusal;
    }

    // 3. Swap inside the edit session, so native undo and the change list see it.
    const body = this.scene.state.body;
    this.applying = true;
    try {
      // Edit actions only run while the sidebar is active.
      this.scene.activateSidebar();
      this.scene.withAssistantWrite(() =>
        applyDashboardSpec({
          scene: this.scene,
          spec: validSpec,
          description: t('dashboard.composer.apply-undo-title', 'Assistant Composer edit'),
          scope: 'composer',
        })
      );
    } catch (error) {
      return { status: 'invalid', message: error instanceof Error ? error.message : String(error) };
    } finally {
      this.applying = false;
    }
    if (this.scene.state.body === body) {
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings -- read by the Assistant model
      return { status: 'denied', message: 'The dashboard did not accept the edit.' };
    }
    this.revision++;
    this.setOverlayState({ layoutTick: this.overlayState.layoutTick + 1 });
    this.scene.recordEditMutation('assistant');
    this.scene.forceRender();
    return { status: 'applied', appliedSpec: transformSceneToSaveModelSchemaV2(this.scene), revision: this.revision };
  }

  /* eslint-disable @grafana/i18n/no-untranslated-strings -- outcome messages are read by the Assistant model, not shown in the UI */
  private checkWrite(signal: AbortSignal, baseRevision: number): ApplyOutcome | undefined {
    if (this.closed || !this.scene.isActive || this.scene.getComposerSession() !== this) {
      return { status: 'closed', message: 'The Composer session has ended. Nothing was changed.' };
    }
    if (signal.aborted) {
      return { status: 'aborted', message: 'The request was stopped before the edit was applied.' };
    }
    if (!dashboardComposerEnabled()) {
      return { status: 'closed', message: 'Composer is turned off. Nothing was changed.' };
    }
    if (!canStillEdit(this.scene)) {
      return { status: 'denied', message: 'You no longer have permission to edit this dashboard.' };
    }
    if (baseRevision !== this.revision) {
      return {
        status: 'stale',
        message: `The dashboard changed since it was read (revision ${baseRevision}, now ${this.revision}). Read it again.`,
      };
    }
    return undefined;
  }
  /* eslint-enable @grafana/i18n/no-untranslated-strings */

  public exit(): void {
    if (this.closed) {
      return;
    }
    this.scene.exitComposerMode();
    // The scene closes the session when its mode changes; this covers a scene already out of Composer.
    this.close();
  }

  /** @internal Called by the scene when it leaves Composer, and by `exit`. */
  public close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.cancelPick();
    this.controller.abort();
    this.cleanups.splice(0).forEach((cleanup) => cleanup());
    this.anchors.forEach((anchor) => anchor.remove());
    this.anchors.clear();
    this.requestMeasure = undefined;
    this.annotationListeners.clear();
    this.annotationHoverListeners.clear();
    this.overlayState = INITIAL_OVERLAY_STATE;
    this.notify();
    appEvents.publish(new SetExtensionSidebarPresentationEvent({ presentation: 'docked' }));
  }

  public get isClosed(): boolean {
    return this.closed;
  }

  /** @internal The overlay's view of the session. */
  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** @internal */
  public getOverlayState = (): ComposerOverlayState => this.overlayState;

  /** @internal The overlay resolves the active pick, or cancels it with null. */
  public completePick(pick: ElementPick | null): void {
    const resolve = this.pendingPick;
    if (!resolve) {
      return;
    }
    this.pendingPick = undefined;
    if (!this.closed) {
      this.setOverlayState({ picking: false });
    }
    resolve(pick);
  }

  /** @internal A pin was clicked or activated from the keyboard. Ignored while paused. */
  public activateAnnotation(id: string): void {
    if (this.closed || this.overlayState.paused || !this.findAnnotation(id)) {
      return;
    }
    this.annotationListeners.forEach((listener) => listener(id));
  }

  /** @internal A pin gained (id) or lost (null) pointer hover or focus. Ignored while paused. */
  public hoverAnnotation(id: string | null): void {
    if (this.closed || this.overlayState.paused || (id !== null && !this.findAnnotation(id))) {
      return;
    }
    this.annotationHoverListeners.forEach((listener) => listener(id));
  }

  /** @internal The overlay hosts and positions the anchor containers; a new host takes the existing ones over. */
  public setAnchorHost(host: HTMLElement | null, requestMeasure?: () => void): void {
    this.anchorHost = host;
    this.requestMeasure = host ? requestMeasure : undefined;
    if (host) {
      this.anchors.forEach((anchor) => host.appendChild(anchor));
    }
  }

  /** @internal */
  public getAnchors(): ReadonlyMap<string, HTMLDivElement> {
    return this.anchors;
  }

  /** @internal The rendered DOM root of the element a ref points at. */
  public findElementRoot(ref: ElementRef): HTMLElement | null {
    const key = this.getPanelKey(ref);
    return key ? document.querySelector<HTMLElement>(`[data-viz-panel-key="${CSS.escape(key)}"]`) : null;
  }

  /** @internal Resolves the panel rendered under a `data-viz-panel-key` DOM root. */
  public resolvePanelPick(key: string, point: ElementPoint = ORIGIN): ElementPick | null {
    const found = sceneGraph.findObject(this.scene, (obj) => obj.state.key === key);
    if (!(found instanceof VizPanel)) {
      return null;
    }
    // A repeat resolves to its source panel, which shares the id.
    const panelId = getPanelIdForVizPanel(found);
    if (!Number.isFinite(panelId)) {
      return null;
    }
    const source = this.findPanel(panelId) ?? found;
    return {
      ref: { kind: 'panel', panelId },
      label: source.state.title || t('dashboard.composer.untitled-panel', 'Panel {{panelId}}', { panelId }),
      tabPath: getTabPath(source),
      point: { x: clamp01(point.x), y: clamp01(point.y) },
    };
  }

  /** @internal The DOM key of the panel a ref points at, for highlighting. */
  public getPanelKey(ref: ElementRef): string | undefined {
    return ref.kind === 'panel' ? this.findPanel(ref.panelId)?.state.key : undefined;
  }

  private findAnnotation(id: string): ComposerAnnotation | undefined {
    return this.overlayState.annotations.find((item) => item.id === id);
  }

  private findPanel(panelId: number): VizPanel | undefined {
    return this.scene.state.body
      .getVizPanels()
      .find((panel) => !isRepeatCloneOrChildOf(panel) && getPanelIdForVizPanel(panel) === panelId);
  }

  private cancelPick() {
    this.completePick(null);
  }

  private setOverlayState(update: Partial<ComposerOverlayState>) {
    this.overlayState = { ...this.overlayState, ...update };
    this.notify();
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }
}

function isInHiddenTab(obj: SceneObject): boolean {
  for (let parent = obj.parent; parent; parent = parent.parent) {
    if (parent instanceof TabItem && !parent.isCurrentTab()) {
      return true;
    }
  }
  return false;
}

/** The nearest ancestor that scrolls vertically, else the document's scroller. */
function getScrollContainer(element: HTMLElement): HTMLElement {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const { overflowY } = getComputedStyle(parent);
    if (/(auto|scroll|overlay)/.test(overflowY) && parent.scrollHeight > parent.clientHeight) {
      return parent;
    }
  }
  return document.scrollingElement instanceof HTMLElement ? document.scrollingElement : document.documentElement;
}

function getVisibleBounds(container: HTMLElement): { top: number; bottom: number } {
  if (container === document.scrollingElement || container === document.documentElement) {
    return { top: 0, bottom: window.innerHeight };
  }
  const rect = container.getBoundingClientRect();
  return { top: Math.max(rect.top, 0), bottom: Math.min(rect.bottom, window.innerHeight) };
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

function getTabPath(obj: SceneObject): string[] {
  const path: string[] = [];
  for (let parent = obj.parent; parent; parent = parent.parent) {
    if (parent instanceof TabItem) {
      path.unshift(parent.state.title ?? '');
    }
  }
  return path;
}

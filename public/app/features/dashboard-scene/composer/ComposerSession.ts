import { ClientProviderEvents } from '@openfeature/web-sdk';

import { generateUUID } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getFeatureFlagClient } from '@grafana/runtime/internal';
import { sceneGraph, SceneObjectStateChangedEvent, VizPanel, type SceneObject } from '@grafana/scenes';

import { applyDashboardSpec } from '../actions/dashboard/applyDashboardSpec';
import type { DashboardScene } from '../scene/DashboardScene';
import { dashboardComposerEnabled } from '../scene/dashboardModes';
import { TabItem } from '../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../scene/layout-tabs/TabsLayoutManager';
import { transformSceneToSaveModelSchemaV2 } from '../serialization/transformSceneToSaveModelSchemaV2';
import { DashboardStateChangedEvent } from '../sidebar/events';
import { isRepeatCloneOrChildOf } from '../utils/clone';
import { getPanelIdForVizPanel } from '../utils/utils-panels';
import { dashboardV2SpecSchema } from '../v2schema/dashboardV2Schema';

import { canEnterComposer, canStillEdit } from './composerAccess';
import { CAPTURE_TIMEOUT_MS, failed, renderRegionImage } from './regionCapture';
import {
  type ApplyOutcome,
  type ComposerAnnotation,
  type ComposerDashboardSpec,
  type ComposerElement,
  type ComposerSessionAPI,
  type ComposerTarget,
  type ElementPick,
  type ElementPoint,
  type ElementRef,
  type RegionCapture,
  type RegionPick,
} from './types';

/** Left out of region captures: Composer's own layer and the extension sidebar. */
export const CAPTURE_EXCLUDE_SELECTOR = '[data-composer-capture-exclude], [data-extension-sidebar]';

/** A rectangle in CSS pixels; relative to the overlay unless said otherwise. */
export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** A drawn region, kept in overlay (dashboard content) coordinates so it scrolls with the content. */
interface StoredRegion {
  box: Box;
  /** The tabs that were selected when it was drawn; it is shown only while all of them still are. */
  tabKeys: string[];
}

type PickResult = ElementPick | RegionPick | null;

/** What the overlay renders. A new object on every change, for `useSyncExternalStore`. */
export interface ComposerOverlayState {
  picking: boolean;
  /** Which tool the pending pick uses; null when none is pending. */
  pickMode: 'element' | 'region' | null;
  /** A region capture is running: picking and tab switching wait for it. */
  capturing: boolean;
  paused: boolean;
  highlight: ElementRef | null;
  annotations: ComposerAnnotation[];
  /** Bumps when the dashboard definition changes, so the overlay re-measures. */
  layoutTick: number;
}

const INITIAL_OVERLAY_STATE: ComposerOverlayState = {
  picking: false,
  pickMode: null,
  capturing: false,
  paused: false,
  highlight: null,
  annotations: [],
  layoutTick: 0,
};

const ORIGIN: ElementPoint = { x: 0, y: 0 };
const MAX_INTERSECTS = 20;

/**
 * One Composer session, bound to the dashboard it was entered on. Writes go to that scene only,
 * never to whichever mutation client is newest on the global stack (that can be a notebook).
 *
 * `revision` increases on every definition change, whatever its source: this session's applies, and
 * every edit action, undo or redo the dashboard records. A write prepared against an older revision is
 * refused, so Assistant never overwrites a change it has not read.
 */
export class ComposerSession implements ComposerSessionAPI {
  public readonly target: ComposerTarget;

  private readonly controller = new AbortController();
  private revision = 0;
  private applying = false;
  private closed = false;
  private pendingPick?: (pick: PickResult) => void;
  private readonly regions = new Map<string, StoredRegion>();
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
      throw new Error(`Composer is not available: ${check.ok ? 'no_document' : check.reason}`);
    }
    const session = new ComposerSession(scene);
    if (!scene.enterComposerMode(session)) {
      throw new Error('Composer is not available: unsupported');
    }
    session.start();
    return session;
  }

  private constructor(private readonly scene: DashboardScene) {
    this.target = { resource: 'dashboard', uid: scene.state.uid ?? '' };
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

    // Switching tabs mounts other panels and shows other regions without a definition change.
    const tabChanged = this.scene.subscribeToEvent(SceneObjectStateChangedEvent, ({ payload }) => {
      if (payload.changedObject instanceof TabsLayoutManager && 'currentTabSlug' in payload.partialUpdate) {
        this.setOverlayState({ layoutTick: this.overlayState.layoutTick + 1 });
      }
    });
    this.cleanups.push(() => tabChanged.unsubscribe());

    // Turning the flag off ends the session; unsaved edits stay.
    const client = getFeatureFlagClient();
    const onFlagsChanged = () => {
      if (!dashboardComposerEnabled()) {
        this.exit();
      }
    };
    client.addHandler(ClientProviderEvents.ConfigurationChanged, onFlagsChanged);
    this.cleanups.push(() => client.removeHandler(ClientProviderEvents.ConfigurationChanged, onFlagsChanged));
  }

  public pickElement(signal: AbortSignal): Promise<ElementPick | RegionPick | null> {
    return this.startPick('element', signal);
  }

  public pickRegion(signal: AbortSignal): Promise<RegionPick | null> {
    return this.startPick('region', signal).then((pick) => (pick && 'rect' in pick ? pick : null));
  }

  private startPick(mode: 'element' | 'region', signal: AbortSignal): Promise<PickResult> {
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
      this.setOverlayState({ picking: true, pickMode: mode });
    });
  }

  public async captureRegion(regionId: string, signal: AbortSignal): Promise<RegionCapture> {
    const region = this.regions.get(regionId);
    const overlay = this.getOverlayRoot();
    // The dashboard's own container (controls and body), which the overlay covers exactly.
    const container = overlay?.parentElement;
    if (this.closed || signal.aborted || !region || !overlay || !container) {
      return failed('failed');
    }
    if (this.overlayState.capturing) {
      return failed('busy');
    }
    const rect = this.getRegionViewportRect(regionId);
    if (!rect || !isFullyVisible(rect, getVisibleBounds(getScrollContainer(overlay)))) {
      return failed('not_visible');
    }

    this.setOverlayState({ capturing: true });
    let settled = false;
    const cleanups: Array<() => void> = [];
    const result = await new Promise<RegionCapture>((resolve) => {
      const settle = (outcome: RegionCapture) => {
        if (!settled) {
          settled = true;
          resolve(outcome);
        }
      };
      const onAbort = () => settle(failed('failed'));
      const onScroll = () => settle(failed('not_visible'));
      const timer = setTimeout(() => settle(failed('timeout')), CAPTURE_TIMEOUT_MS);
      signal.addEventListener('abort', onAbort, { once: true });
      this.signal.addEventListener('abort', onAbort, { once: true });
      window.addEventListener('scroll', onScroll, { capture: true, passive: true });
      cleanups.push(
        () => clearTimeout(timer),
        () => signal.removeEventListener('abort', onAbort),
        () => this.signal.removeEventListener('abort', onAbort),
        () => window.removeEventListener('scroll', onScroll, { capture: true })
      );
      renderRegionImage({
        root: container,
        region: rect,
        exclude: (candidate) => candidate instanceof Element && candidate.matches(CAPTURE_EXCLUDE_SELECTOR),
        // A settled capture is dropped: its buffers are freed and its result never returned.
        isCancelled: () => settled,
      }).then(settle, () => settle(failed('failed')));
    });
    cleanups.forEach((cleanup) => cleanup());
    if (!this.closed) {
      this.setOverlayState({ capturing: false });
    }
    return result;
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
    // A region lives only while an annotation points at it.
    const regionIds = new Set(annotations.flatMap(({ ref }) => (ref.kind === 'region' ? [ref.regionId] : [])));
    for (const regionId of this.regions.keys()) {
      if (!regionIds.has(regionId)) {
        this.regions.delete(regionId);
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
    if (this.closed || !item || !this.resolves(item.ref)) {
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
    if (this.closed || !item) {
      return;
    }
    const behavior: ScrollBehavior = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      ? 'auto'
      : 'smooth';
    if (item.ref.kind === 'region') {
      this.revealRegion(item.ref.regionId, item.point, behavior);
      return;
    }
    const panel = item.ref.kind === 'panel' ? this.findPanel(item.ref.panelId) : undefined;
    const element = this.findElementRoot(item.ref);
    if (!panel || !element || isInHiddenTab(panel)) {
      return;
    }
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

  private revealRegion(regionId: string, point: ElementPoint, behavior: ScrollBehavior) {
    const root = this.getOverlayRoot();
    const rect = this.getRegionViewportRect(regionId);
    if (!root || !rect) {
      return;
    }
    const container = getScrollContainer(root);
    const visible = getVisibleBounds(container);
    let delta = 0;
    if (rect.height > visible.bottom - visible.top) {
      delta = rect.top + point.y * rect.height - (visible.top + visible.bottom) / 2;
    } else if (rect.top < visible.top) {
      delta = rect.top - visible.top;
    } else if (rect.top + rect.height > visible.bottom) {
      delta = rect.top + rect.height - visible.bottom;
    }
    if (delta !== 0) {
      container.scrollBy({ top: delta, behavior });
    }
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
    // Restoring the saved spec (Assistant Undo) leaves nothing to save.
    this.scene.clearDirtyIfUnchanged();
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
    this.regions.clear();
    this.requestMeasure = undefined;
    this.annotationListeners.clear();
    this.annotationHoverListeners.clear();
    this.overlayState = INITIAL_OVERLAY_STATE;
    this.notify();
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
  public completePick(pick: PickResult): void {
    const resolve = this.pendingPick;
    if (!resolve) {
      return;
    }
    this.pendingPick = undefined;
    if (!this.closed) {
      this.setOverlayState({ picking: false, pickMode: null });
    }
    resolve(pick);
  }

  /**
   * @internal Registers the rectangle the user drew (viewport coordinates) as a region and describes it.
   * Null when the overlay is not mounted.
   */
  public createRegionPick(rect: Box): RegionPick | null {
    const root = this.getOverlayRoot();
    if (this.closed || !root) {
      return null;
    }
    const rootRect = root.getBoundingClientRect();
    const tabs = getSelectedTabChain(this.scene);
    const regionId = `region-${generateUUID()}`;
    this.regions.set(regionId, {
      box: { left: rect.left - rootRect.left, top: rect.top - rootRect.top, width: rect.width, height: rect.height },
      tabKeys: tabs.map((tab) => tab.state.key ?? ''),
    });

    // Normalised to the visible part of the dashboard.
    const visibleLeft = Math.max(rootRect.left, 0);
    const visibleTop = Math.max(rootRect.top, 0);
    const visibleWidth = Math.max(Math.min(rootRect.left + rootRect.width, window.innerWidth) - visibleLeft, 1);
    const visibleHeight = Math.max(Math.min(rootRect.top + rootRect.height, window.innerHeight) - visibleTop, 1);
    const tabPath = tabs.map((tab) => tab.state.title ?? '');
    const timeRange = sceneGraph.getTimeRange(this.scene);

    return {
      ref: { kind: 'region', regionId },
      label: t('dashboard.composer.region', 'Region'),
      rect: {
        x: clamp01((rect.left - visibleLeft) / visibleWidth),
        y: clamp01((rect.top - visibleTop) / visibleHeight),
        width: clamp01(rect.width / visibleWidth),
        height: clamp01(rect.height / visibleHeight),
      },
      point: { x: 1, y: 0 },
      tabPath,
      intersects: this.findIntersectingPanels(rect),
      timeRange: {
        from: String(timeRange.state.from),
        to: String(timeRange.state.to),
        timezone: timeRange.getTimeZone(),
      },
    };
  }

  /** @internal Where a ref sits relative to the overlay, or null when it is not on screen to draw. */
  public resolveBox(ref: ElementRef, rootRect: DOMRect): Box | null {
    if (ref.kind === 'region') {
      const region = this.regions.get(ref.regionId);
      return region && this.isRegionShown(region) ? region.box : null;
    }
    const rect = this.findElementRoot(ref)?.getBoundingClientRect();
    return rect
      ? { top: rect.top - rootRect.top, left: rect.left - rootRect.left, width: rect.width, height: rect.height }
      : null;
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

  private resolves(ref: ElementRef): boolean {
    if (ref.kind === 'region') {
      const region = this.regions.get(ref.regionId);
      return Boolean(region && this.isRegionShown(region));
    }
    return Boolean(this.findElementRoot(ref));
  }

  private isRegionShown({ tabKeys }: StoredRegion): boolean {
    return tabKeys.every((key) => {
      const tab = sceneGraph.findObject(this.scene, (obj) => obj.state.key === key);
      return tab instanceof TabItem && isSelectedTab(tab);
    });
  }

  /** The region in viewport coordinates, or null when it is unknown or its tab is not selected. */
  private getRegionViewportRect(regionId: string): Box | null {
    const root = this.getOverlayRoot();
    const region = this.regions.get(regionId);
    if (!root || !region || !this.isRegionShown(region)) {
      return null;
    }
    const rootRect = root.getBoundingClientRect();
    return { ...region.box, left: rootRect.left + region.box.left, top: rootRect.top + region.box.top };
  }

  private findIntersectingPanels(rect: Box): Array<{ ref: ElementRef; label: string }> {
    const found = new Map<number, string>();
    for (const panel of this.scene.state.body.getVizPanels()) {
      if (found.size >= MAX_INTERSECTS) {
        break;
      }
      const key = panel.state.key;
      const element = key ? document.querySelector(`[data-viz-panel-key="${CSS.escape(key)}"]`) : null;
      const panelId = getPanelIdForVizPanel(panel);
      if (!element || !Number.isFinite(panelId) || found.has(panelId)) {
        continue;
      }
      const bounds = element.getBoundingClientRect();
      const overlapWidth = Math.min(rect.left + rect.width, bounds.right) - Math.max(rect.left, bounds.left);
      const overlapHeight = Math.min(rect.top + rect.height, bounds.bottom) - Math.max(rect.top, bounds.top);
      if (overlapWidth > 0 && overlapHeight > 0) {
        const source = this.findPanel(panelId) ?? panel;
        found.set(
          panelId,
          source.state.title || t('dashboard.composer.untitled-panel', 'Panel {{panelId}}', { panelId })
        );
      }
    }
    return [...found].map(([panelId, label]) => ({ ref: { kind: 'panel', panelId }, label }));
  }

  /** The overlay root: the parent of the anchor host the overlay registers. */
  private getOverlayRoot(): HTMLElement | null {
    return this.anchorHost?.parentElement ?? null;
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

/** The selected tab at each level of nested tabs under the dashboard body, outermost first. */
function getSelectedTabChain(scene: DashboardScene): TabItem[] {
  const chain: TabItem[] = [];
  let layout: unknown = scene.state.body;
  while (layout instanceof TabsLayoutManager) {
    const tab = layout.getCurrentTab();
    if (!tab) {
      break;
    }
    chain.push(tab);
    layout = tab.getLayout();
  }
  return chain;
}

/** Like `TabItem.isCurrentTab`, but also true for the first tab shown before any slug is set. */
function isSelectedTab(tab: TabItem): boolean {
  return tab.parent instanceof TabsLayoutManager && tab.parent.getCurrentTab() === tab;
}

function isFullyVisible(rect: Box, visible: { top: number; bottom: number }): boolean {
  return (
    rect.left >= 0 &&
    rect.left + rect.width <= window.innerWidth &&
    rect.top >= visible.top &&
    rect.top + rect.height <= visible.bottom
  );
}

function isInHiddenTab(obj: SceneObject): boolean {
  for (let parent = obj.parent; parent; parent = parent.parent) {
    if (parent instanceof TabItem && !isSelectedTab(parent)) {
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

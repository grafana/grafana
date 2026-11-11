import { ClientProviderEvents } from '@openfeature/web-sdk';

import { generateUUID } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { getFeatureFlagClient } from '@grafana/runtime/internal';

import type { DashboardScene } from '../scene/DashboardScene';

import { type ComposerDocument } from './ComposerDocument';
import { DashboardComposerDocument } from './DashboardComposerDocument';
import { canEnterComposer } from './composerAccess';
import { type Box, clamp01 } from './composerGeometry';
import { CAPTURE_TIMEOUT_MS, failed, renderRegionImage } from './regionCapture';
import {
  type ApplyOutcome,
  type ComposerAnnotation,
  type ComposerApplyOptions,
  type ComposerDashboardSpec,
  type ComposerElement,
  type ComposerExitResult,
  type ComposerSessionAPI,
  type ComposerTarget,
  type ComposerTool,
  type ElementPick,
  type ElementPoint,
  type ElementRect,
  type ElementRef,
  type PickedText,
  type RegionCapture,
  type RegionPick,
} from './types';

/** Every tool, in the order the plugin shows them. */
const TOOLS: readonly ComposerTool[] = ['select', 'text', 'remove'];

/** Line boxes kept per text highlight; the quote, not the drawing, is what the plugin sends. */
const MAX_TEXT_RECTS = 20;

/** Text picks made in repeat clones that are remembered, newest last, to draw their annotations on. */
const MAX_TEXT_CLONES = 50;

/** Left out of region captures: Composer's own layer and the extension sidebar. */
const CAPTURE_EXCLUDE_SELECTOR = '[data-composer-capture-exclude], [data-extension-sidebar]';

/** The dashboard's own buttons (time picker, refresh, share, mode): a region over them is not captured. */
const DASHBOARD_ACTIONS_SELECTOR = '[data-dashboard-actions]';

/** The dashboard body's scroll container in the sidebar layout, a sibling of the overlay. */
const BODY_SCROLLER_SELECTOR = `[data-testid="${selectors.components.DashboardSidebarSplitter.bodyContainer}"]`;

/**
 * A drawn region, kept relative to the scrolled content of the dashboard's scroll container, so it moves
 * with the dashboard. The overlay itself does not scroll: in the sidebar layout the dashboard body scrolls
 * in its own container under it. The container is found again each time rather than kept, since a rebuilt
 * body replaces it.
 */
interface StoredRegion {
  box: Box;
  /** The tabs that were selected when it was drawn; it is shown only while all of them still are. */
  tabKeys: string[];
  /**
   * Drawn wholly on the dashboard controls, which do not scroll: kept relative to the overlay instead, so it
   * stays on the controls.
   */
  fixed: boolean;
  /** Drawn starting on the controls: seen through the whole overlay, since its top is above the scroller's. */
  onControls: boolean;
}

type PickResult = ElementPick | RegionPick | null;

/** An annotation as the overlay draws it. */
export interface OverlayAnnotation extends ComposerAnnotation {
  /**
   * The DOM key of the repeat clone a Text pick was made in. Its ref names the source panel, which every
   * repeat shares, but its quote, highlight and pin belong to this clone.
   */
  elementKey?: string;
}

/** What the overlay renders. A new object on every change, for `useSyncExternalStore`. */
export interface ComposerOverlayState {
  picking: boolean;
  /** Which pick is pending: an element (any tool) or a region only; null when none is. */
  pickMode: 'element' | 'region' | null;
  /** What a press does during an element pick. */
  tool: ComposerTool;
  /** A region capture is running: picking and tab switching wait for it. */
  capturing: boolean;
  paused: boolean;
  /** A turn runs without pausing: see `setWorking`. */
  working: boolean;
  highlight: ElementRef | null;
  annotations: OverlayAnnotation[];
  /** Bumps when the dashboard definition changes, so the overlay re-measures. */
  layoutTick: number;
}

const INITIAL_OVERLAY_STATE: ComposerOverlayState = {
  picking: false,
  pickMode: null,
  tool: 'select',
  capturing: false,
  paused: false,
  working: false,
  highlight: null,
  annotations: [],
  layoutTick: 0,
};

const ORIGIN: ElementPoint = { x: 0, y: 0 };

/**
 * One Composer session, bound to the document it was entered on. Everything the documents share (picks,
 * regions, pins, anchors, capture) lives here; what differs per resource (finding elements, reading,
 * writing, saving) is the `ComposerDocument` strategy's.
 */
export class ComposerSession<Spec = ComposerDashboardSpec> implements ComposerSessionAPI<Spec> {
  public readonly target: ComposerTarget;
  public readonly closed: Promise<ComposerExitResult>;
  /** Notebooks only: see `ComposerSessionAPI.retrySave`. Before the session ends it waits for the end. */
  public readonly retrySave?: () => Promise<ComposerExitResult>;

  private readonly controller = new AbortController();
  private resolveClosed!: (result: ComposerExitResult) => void;
  private ended = false;
  private pendingPick?: (pick: PickResult) => void;
  private readonly regions = new Map<string, StoredRegion>();
  /** Text picks made in a repeat clone: the pick's signature, and the clone's DOM key. */
  private readonly textClones: Array<{ signature: string; elementKey: string }> = [];
  private overlayState: ComposerOverlayState = INITIAL_OVERLAY_STATE;
  private readonly listeners = new Set<() => void>();
  private readonly annotationListeners = new Set<(id: string) => void>();
  private readonly annotationHoverListeners = new Set<(id: string | null) => void>();
  /** Containers the plugin portals into, kept across re-renders and moved with the overlay. */
  private readonly anchors = new Map<string, HTMLDivElement>();
  private anchorHost: HTMLElement | null = null;
  /** The container the plugin portals its tools bar into; the overlay places it. */
  private toolsHost: HTMLDivElement | null = null;
  private readonly toolListeners = new Set<(tool: ComposerTool) => void>();
  private requestMeasure?: () => void;
  private readonly cleanups: Array<() => void> = [];

  /** Enters Composer on `scene`. Throws when it cannot, with the reason `canEnterComposer` gives. */
  public static enter(scene: DashboardScene | null): ComposerSession {
    const check = canEnterComposer(scene);
    if (!check.ok || !scene) {
      throw new Error(`Composer is not available: ${check.ok ? 'no_document' : check.reason}`);
    }
    return ComposerSession.open(new DashboardComposerDocument(scene));
  }

  /** Enters Composer on `document`, whose own checks have passed. Throws when its scene refuses. */
  public static open<S>(document: ComposerDocument<S, ComposerSession<S>>): ComposerSession<S> {
    const session = new ComposerSession<S>(document);
    if (!document.attach(session)) {
      throw new Error('Composer is not available: unsupported');
    }
    session.start();
    return session;
  }

  private constructor(private readonly document: ComposerDocument<Spec, ComposerSession<Spec>>) {
    this.target = document.target;
    this.closed = new Promise((resolve) => {
      this.resolveClosed = resolve;
    });
    const retry = document.retrySave?.bind(document);
    if (retry) {
      this.retrySave = () => (this.ended ? retry() : this.closed);
    }
  }

  /** @internal What the overlay hit-tests for element picks. */
  public get elementSelector(): string {
    return this.document.elementSelector;
  }

  /** @internal */
  public get elementKeyAttribute(): string {
    return this.document.elementKeyAttribute;
  }

  /** @internal The pick hint over a pickable element. */
  public elementHint(): string {
    return this.document.elementHint();
  }

  public get signal(): AbortSignal {
    return this.controller.signal;
  }

  public get tools(): readonly ComposerTool[] {
    return TOOLS;
  }

  public get tool(): ComposerTool {
    return this.overlayState.tool;
  }

  public setTool(tool: ComposerTool): void {
    if (this.ended || !TOOLS.includes(tool) || tool === this.overlayState.tool) {
      return;
    }
    // A selection begun with the Text tool must not survive into a tool that blocks it.
    window.getSelection()?.removeAllRanges();
    this.setOverlayState({ tool });
    this.toolListeners.forEach((listener) => listener(tool));
  }

  public onToolChange(listener: (tool: ComposerTool) => void): () => void {
    if (this.ended) {
      return () => {};
    }
    this.toolListeners.add(listener);
    return () => this.toolListeners.delete(listener);
  }

  public getToolsHost(): HTMLElement | null {
    if (this.ended) {
      return null;
    }
    if (!this.toolsHost) {
      const host = document.createElement('div');
      host.dataset.composerToolsHost = '';
      // Sized and placed by the overlay over the visible dashboard body; only the plugin's bar takes pointers.
      Object.assign(host.style, {
        position: 'fixed',
        pointerEvents: 'none',
        left: '0',
        top: '0',
        width: '0',
        height: '0',
      });
      this.toolsHost = host;
      // Before the anchors, so an open comment editor paints over the bar.
      this.anchorHost?.parentElement?.insertBefore(host, this.anchorHost);
      this.requestMeasure?.();
    }
    return this.toolsHost;
  }

  /** @internal The overlay places the tools host; null before it is first asked for. */
  public getToolsHostElement(): HTMLDivElement | null {
    return this.toolsHost;
  }

  private start() {
    this.cleanups.push(
      this.document.start({
        layoutChanged: () => this.setOverlayState({ layoutTick: this.overlayState.layoutTick + 1 }),
      })
    );

    // Turning the flag off ends the session; unsaved edits stay (a notebook saves them on the way out).
    const client = getFeatureFlagClient();
    const onFlagsChanged = () => {
      if (!this.document.isEnabled()) {
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
    if (this.ended || this.overlayState.paused || signal.aborted) {
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
    if (this.ended || signal.aborted || !region || !overlay || !container) {
      return failed('failed');
    }
    if (this.overlayState.capturing) {
      return failed('busy');
    }
    const rect = this.getRegionViewportRect(regionId);
    if (!rect || !isFullyVisible(rect, getVisibleBounds(getRegionView(overlay, region)))) {
      return failed('not_visible');
    }
    if (overlapsAny(rect, container.querySelectorAll(DASHBOARD_ACTIONS_SELECTOR))) {
      return failed('controls');
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
        // Rendering only what the region needs keeps tall dashboards fast; the crop is relative to it.
        root: this.document.findCaptureRoot(rect, container),
        region: rect,
        exclude: (candidate) => candidate instanceof Element && candidate.matches(CAPTURE_EXCLUDE_SELECTOR),
        // A settled capture is dropped: its buffers are freed and its result never returned.
        isCancelled: () => settled,
      }).then(settle, () => settle(failed('failed')));
    });
    cleanups.forEach((cleanup) => cleanup());
    if (!this.ended) {
      this.setOverlayState({ capturing: false });
    }
    return result;
  }

  public listElements(): ComposerElement[] {
    return [];
  }

  public highlight(target: ElementRef | null): void {
    if (!this.ended) {
      this.setOverlayState({ highlight: target });
    }
  }

  public setPaused(paused: boolean): void {
    if (this.ended) {
      return;
    }
    if (paused) {
      this.cancelPick();
    }
    this.setOverlayState({ paused });
  }

  public setWorking(working: boolean): void {
    if (!this.ended) {
      this.setOverlayState({ working });
    }
  }

  /** @internal Whether the Assistant is running a turn, paused or not: leaving then stops it. */
  public get assistantWorking(): boolean {
    return this.overlayState.paused || this.overlayState.working;
  }

  public setAnnotations(items: ComposerAnnotation[]): void {
    if (this.ended) {
      return;
    }
    const annotations = items.map(
      ({ id, ref, point, label, state, alsoRefs, tone, textRects }): OverlayAnnotation => ({
        id,
        ref: { ...ref },
        point: { x: clamp01(point.x), y: clamp01(point.y) },
        label: label.slice(0, 3),
        state,
        ...(Array.isArray(alsoRefs) && alsoRefs.length > 0 ? { alsoRefs: alsoRefs.map((also) => ({ ...also })) } : {}),
        ...(tone === 'remove' ? { tone } : {}),
        ...(Array.isArray(textRects) && textRects.length > 0 && ref.kind !== 'region'
          ? {
              textRects: textRects.slice(0, MAX_TEXT_RECTS).map((rect) => ({
                x: clamp01(rect.x),
                y: clamp01(rect.y),
                width: clamp01(rect.width),
                height: clamp01(rect.height),
              })),
            }
          : {}),
        ...this.findTextClone(ref, point, Array.isArray(textRects) ? textRects : []),
      })
    );
    const ids = new Set(annotations.map(({ id }) => id));
    for (const [id, anchor] of this.anchors) {
      if (!ids.has(id)) {
        anchor.remove();
        this.anchors.delete(id);
      }
    }
    // A region lives only while an annotation points at it.
    const regionIds = new Set(
      annotations.flatMap(({ ref, alsoRefs = [] }) =>
        [ref, ...alsoRefs].flatMap((each) => (each.kind === 'region' ? [each.regionId] : []))
      )
    );
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
    if (this.ended || !item || !this.resolves(item.ref)) {
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
    if (this.ended || !item) {
      return;
    }
    const behavior: ScrollBehavior = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      ? 'auto'
      : 'smooth';
    if (item.ref.kind === 'region') {
      this.revealRegion(item.ref.regionId, item.point, behavior);
      return;
    }
    const element = this.findAnnotationRoot(item);
    if (!element || this.document.isHidden(item.ref)) {
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
    const region = this.regions.get(regionId);
    const rect = this.getRegionViewportRect(regionId);
    if (!root || !region || region.fixed || !rect) {
      return;
    }
    const container = getRegionScroller(root);
    const visible = getVisibleBounds(getRegionView(root, region));
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

  public async readSpec(): Promise<{ spec: Spec; revision: number }> {
    if (this.ended) {
      throw new Error('The Composer session has ended.');
    }
    return this.document.readSpec();
  }

  public applySpec(spec: Spec, opts: ComposerApplyOptions): Promise<ApplyOutcome<Spec>> {
    return this.document.applySpec(spec, opts, () => !this.ended);
  }

  public get canWrite(): boolean {
    return !this.ended && (this.document.canWrite?.() ?? true);
  }

  public onCanWriteChange(listener: (canWrite: boolean) => void): () => void {
    if (this.ended || !this.document.onCanWriteChange) {
      return () => {};
    }
    const stop = this.document.onCanWriteChange((canWrite) => {
      if (!this.ended) {
        listener(canWrite);
      }
    });
    this.cleanups.push(stop);
    return stop;
  }

  public exit(): void | Promise<ComposerExitResult> {
    if (!this.ended) {
      this.document.detach();
      // The scene closes the session when it leaves Composer; this covers a scene already out of it.
      this.close();
    }
    return this.document.reportsSave ? this.closed : undefined;
  }

  /** @internal Called by the scene when it leaves Composer, and by `exit`. */
  public close(): void {
    if (this.ended) {
      return;
    }
    this.ended = true;
    this.cancelPick();
    this.controller.abort();
    this.cleanups.splice(0).forEach((cleanup) => cleanup());
    this.anchors.forEach((anchor) => anchor.remove());
    this.anchors.clear();
    this.toolsHost?.remove();
    this.toolsHost = null;
    this.toolListeners.clear();
    this.regions.clear();
    this.requestMeasure = undefined;
    this.annotationListeners.clear();
    this.annotationHoverListeners.clear();
    this.overlayState = INITIAL_OVERLAY_STATE;
    this.notify();
    this.document.finish().then(this.resolveClosed, () => this.resolveClosed({}));
  }

  public get isClosed(): boolean {
    return this.ended;
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
    if (!this.ended) {
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
    if (this.ended || !root) {
      return null;
    }
    const rootRect = root.getBoundingClientRect();
    const { tabKeys, tabPath, timeRange } = this.document.regionContext();
    const regionId = `region-${generateUUID()}`;
    const scrollerTop = getVisibleBounds(getRegionScroller(root)).top;
    const fixed = rect.top + rect.height <= scrollerTop;
    const origin = getContentOrigin(getRegionFrame(root, { fixed }));
    this.regions.set(regionId, {
      box: { left: rect.left - origin.left, top: rect.top - origin.top, width: rect.width, height: rect.height },
      tabKeys,
      fixed,
      onControls: rect.top < scrollerTop,
    });

    // Normalised to the visible part of the dashboard.
    const visibleLeft = Math.max(rootRect.left, 0);
    const visibleTop = Math.max(rootRect.top, 0);
    const visibleWidth = Math.max(Math.min(rootRect.left + rootRect.width, window.innerWidth) - visibleLeft, 1);
    const visibleHeight = Math.max(Math.min(rootRect.top + rootRect.height, window.innerHeight) - visibleTop, 1);

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
      intersects: this.document.findIntersectingElements(rect, root.parentElement),
      timeRange,
    };
  }

  /** @internal Where an annotation's element sits relative to the overlay: see `findAnnotationRoot`. */
  public resolveAnnotationBox(item: OverlayAnnotation, rootRect: DOMRect): Box | null {
    if (item.ref.kind === 'region') {
      return this.resolveBox(item.ref, rootRect);
    }
    const rect = this.findAnnotationRoot(item)?.getBoundingClientRect();
    return rect
      ? { top: rect.top - rootRect.top, left: rect.left - rootRect.left, width: rect.width, height: rect.height }
      : null;
  }

  /**
   * @internal The element an annotation is drawn on: for a Text pick made in a repeat clone, that clone while
   * it is rendered, else the element its ref names.
   */
  public findAnnotationRoot(item: OverlayAnnotation): HTMLElement | null {
    const clone = item.elementKey ? this.findElementByKey(item.elementKey) : null;
    return clone ?? this.findElementRoot(item.ref);
  }

  /**
   * @internal Whether an annotation's text highlight can be drawn: not once the repeat clone it was selected
   * in is gone (the variable's values changed), since another repeat holds other text.
   */
  public isTextAnchored(item: OverlayAnnotation): boolean {
    return !item.elementKey || Boolean(this.findElementByKey(item.elementKey));
  }

  /** @internal Where a ref sits relative to the overlay, or null when it is not on screen to draw. */
  public resolveBox(ref: ElementRef, rootRect: DOMRect): Box | null {
    if (ref.kind === 'region') {
      const rect = this.getRegionViewportRect(ref.regionId);
      return rect && { ...rect, left: rect.left - rootRect.left, top: rect.top - rootRect.top };
    }
    const rect = this.findElementRoot(ref)?.getBoundingClientRect();
    return rect
      ? { top: rect.top - rootRect.top, left: rect.left - rootRect.left, width: rect.width, height: rect.height }
      : null;
  }

  /**
   * @internal A pin was clicked or activated from the keyboard. Ignored while paused. A pin held at the
   * overlay's edge points at a comment out of view: that comment is scrolled into view first.
   */
  public activateAnnotation(id: string): void {
    const item = this.findAnnotation(id);
    if (this.ended || this.overlayState.paused || !item) {
      return;
    }
    if (!this.isPinPointInView(item)) {
      this.revealAnnotation(id);
    }
    this.annotationListeners.forEach((listener) => listener(id));
  }

  /** Whether the point a pin marks is within the visible part of its scroll container. True when unknown. */
  private isPinPointInView(item: OverlayAnnotation): boolean {
    const { ref, point } = item;
    let rect: Box | null = null;
    let container: HTMLElement | undefined;
    if (ref.kind === 'region') {
      rect = this.getRegionViewportRect(ref.regionId);
      const root = this.getOverlayRoot();
      const region = this.regions.get(ref.regionId);
      container = root && region ? getRegionView(root, region) : undefined;
    } else {
      const element = this.findAnnotationRoot(item);
      rect = element?.getBoundingClientRect() ?? null;
      container = element ? getScrollContainer(element) : undefined;
    }
    if (!rect || !container) {
      return true;
    }
    const y = rect.top + point.y * rect.height;
    const visible = getVisibleBounds(container);
    return y >= visible.top && y <= visible.bottom;
  }

  /** @internal A pin gained (id) or lost (null) pointer hover or focus. Ignored while paused. */
  public hoverAnnotation(id: string | null): void {
    if (this.ended || this.overlayState.paused || (id !== null && !this.findAnnotation(id))) {
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
      // Beside the anchors, under the overlay root: inside the layer the overlay excludes from hit-testing.
      if (this.toolsHost) {
        host.parentElement?.insertBefore(this.toolsHost, host);
      }
    }
  }

  /** @internal */
  public getAnchors(): ReadonlyMap<string, HTMLDivElement> {
    return this.anchors;
  }

  /** @internal The rendered DOM root of the element a ref points at. */
  public findElementRoot(ref: ElementRef): HTMLElement | null {
    return this.document.findElementRoot(ref, this.getOverlayRoot()?.parentElement ?? null);
  }

  /** @internal Resolves a dashboard variable whose control has `key`; null on other documents. */
  public resolveVariablePick(key: string): ElementPick | null {
    return this.document.resolveVariablePick?.(key) ?? null;
  }

  /** @internal Resolves an annotation or data layer whose control has `key`; null on other documents. */
  public resolveAnnotationPick(key: string): ElementPick | null {
    return this.document.resolveAnnotationPick?.(key) ?? null;
  }

  /** @internal Resolves the element rendered under a DOM root whose `elementKeyAttribute` is `key`. */
  public resolveElementPick(key: string, point: ElementPoint = ORIGIN): ElementPick | null {
    return this.document.resolveElementPick(key, point);
  }

  /**
   * @internal Resolves a Text pick made inside the DOM root whose `elementKeyAttribute` is `key`. In a repeat
   * clone the pick's ref names the source panel, so the clone is remembered and its annotation, which the
   * plugin draws with the pick's ref, point and rects, is drawn on the clone the text came from.
   */
  public resolveTextPick(key: string, point: ElementPoint, text: PickedText): ElementPick | null {
    const pick = this.resolveElementPick(key, point);
    if (!pick) {
      return null;
    }
    if (this.findElementRoot(pick.ref)?.getAttribute(this.elementKeyAttribute) !== key) {
      this.textClones.push({ signature: textSignature(pick.ref, pick.point, text.rects), elementKey: key });
      if (this.textClones.length > MAX_TEXT_CLONES) {
        this.textClones.shift();
      }
    }
    return { ...pick, tool: 'text', text };
  }

  /** The repeat clone a Text pick with this ref, point and rects was made in, as an annotation's field. */
  private findTextClone(ref: ElementRef, point: ElementPoint, rects: ElementRect[] = []): { elementKey?: string } {
    if (ref.kind === 'region' || this.textClones.length === 0) {
      return {};
    }
    const signature = textSignature(ref, point, rects);
    for (let index = this.textClones.length - 1; index >= 0; index--) {
      if (this.textClones[index].signature === signature) {
        return { elementKey: this.textClones[index].elementKey };
      }
    }
    return {};
  }

  private findElementByKey(key: string): HTMLElement | null {
    return document.querySelector<HTMLElement>(`[${this.elementKeyAttribute}="${CSS.escape(key)}"]`);
  }

  private resolves(ref: ElementRef): boolean {
    if (ref.kind === 'region') {
      const region = this.regions.get(ref.regionId);
      return Boolean(region && this.isRegionShown(region));
    }
    return Boolean(this.findElementRoot(ref));
  }

  private isRegionShown({ tabKeys }: StoredRegion): boolean {
    return this.document.isRegionShown(tabKeys);
  }

  /** The region in viewport coordinates, or null when it is unknown or its tab is not selected. */
  private getRegionViewportRect(regionId: string): Box | null {
    const root = this.getOverlayRoot();
    const region = this.regions.get(regionId);
    if (!root || !region || !this.isRegionShown(region)) {
      return null;
    }
    const origin = getContentOrigin(getRegionFrame(root, region));
    return { ...region.box, left: origin.left + region.box.left, top: origin.top + region.box.top };
  }

  /** The overlay root: the parent of the anchor host the overlay registers. */
  private getOverlayRoot(): HTMLElement | null {
    return this.anchorHost?.parentElement ?? null;
  }

  private findAnnotation(id: string): OverlayAnnotation | undefined {
    return this.overlayState.annotations.find((item) => item.id === id);
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

/** Tells one Text pick from another by what the plugin draws its annotation with. */
function textSignature(ref: ElementRef, point: ElementPoint, rects: ElementRect[]): string {
  const fields = Object.entries(ref).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return JSON.stringify([fields, point.x, point.y, rects.map(({ x, y, width, height }) => [x, y, width, height])]);
}

function overlapsAny(rect: Box, elements: Iterable<Element>): boolean {
  for (const element of elements) {
    const bounds = element.getBoundingClientRect();
    if (
      bounds.width > 0 &&
      bounds.height > 0 &&
      rect.left < bounds.right &&
      rect.left + rect.width > bounds.left &&
      rect.top < bounds.bottom &&
      rect.top + rect.height > bounds.top
    ) {
      return true;
    }
  }
  return false;
}

function isFullyVisible(rect: Box, visible: { top: number; bottom: number }): boolean {
  return (
    rect.left >= 0 &&
    rect.left + rect.width <= window.innerWidth &&
    rect.top >= visible.top &&
    rect.top + rect.height <= visible.bottom
  );
}

/** The nearest ancestor that scrolls vertically, else the document's scroller. */
function getScrollContainer(element: HTMLElement): HTMLElement {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (scrollsVertically(parent)) {
      return parent;
    }
  }
  return document.scrollingElement instanceof HTMLElement ? document.scrollingElement : document.documentElement;
}

function scrollsVertically(element: HTMLElement): boolean {
  const { overflowY } = getComputedStyle(element);
  return /(auto|scroll|overlay)/.test(overflowY) && element.scrollHeight > element.clientHeight;
}

/**
 * What regions are kept against: the dashboard body's scroll container beside the overlay in the sidebar
 * layout, else the overlay's own scroller, the one the page scrolls in. Looked up each time.
 */
function getRegionScroller(overlayRoot: HTMLElement): HTMLElement {
  const body = overlayRoot.parentElement?.querySelector(BODY_SCROLLER_SELECTOR);
  return body instanceof HTMLElement ? body : getScrollContainer(overlayRoot);
}

/** What a region moves with: the overlay for one fixed on the controls, else its scroller. */
function getRegionFrame(overlayRoot: HTMLElement, { fixed }: Pick<StoredRegion, 'fixed'>): HTMLElement {
  return fixed ? overlayRoot : getRegionScroller(overlayRoot);
}

/** What a region is seen through: the whole overlay for one drawn starting on the controls, else its scroller. */
function getRegionView(overlayRoot: HTMLElement, { onControls }: Pick<StoredRegion, 'onControls'>): HTMLElement {
  return onControls ? overlayRoot : getRegionScroller(overlayRoot);
}

/** Where the scrolled content of `scroller` starts, in viewport coordinates: it moves as `scroller` scrolls. */
function getContentOrigin(scroller: HTMLElement): { left: number; top: number } {
  if (scroller === document.scrollingElement || scroller === document.documentElement) {
    return { left: -window.scrollX, top: -window.scrollY };
  }
  const rect = scroller.getBoundingClientRect();
  return { left: rect.left - scroller.scrollLeft, top: rect.top - scroller.scrollTop };
}

function getVisibleBounds(container: HTMLElement): { top: number; bottom: number } {
  if (container === document.scrollingElement || container === document.documentElement) {
    return { top: 0, bottom: window.innerHeight };
  }
  const rect = container.getBoundingClientRect();
  return { top: Math.max(rect.top, 0), bottom: Math.min(rect.bottom, window.innerHeight) };
}

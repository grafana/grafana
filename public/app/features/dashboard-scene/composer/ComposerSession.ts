import { ClientProviderEvents } from '@openfeature/web-sdk';

import { generateUUID } from '@grafana/data';
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
  type ElementPick,
  type ElementPoint,
  type ElementRef,
  type RegionCapture,
  type RegionPick,
} from './types';

/** Left out of region captures: Composer's own layer and the extension sidebar. */
const CAPTURE_EXCLUDE_SELECTOR = '[data-composer-capture-exclude], [data-extension-sidebar]';

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

  public setAnnotations(items: ComposerAnnotation[]): void {
    if (this.ended) {
      return;
    }
    const annotations = items.map(({ id, ref, point, label, state, alsoRefs }) => ({
      id,
      ref: { ...ref },
      point: { x: clamp01(point.x), y: clamp01(point.y) },
      label: label.slice(0, 3),
      state,
      ...(Array.isArray(alsoRefs) && alsoRefs.length > 0 ? { alsoRefs: alsoRefs.map((also) => ({ ...also })) } : {}),
    }));
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
    const element = this.findElementRoot(item.ref);
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

  public async readSpec(): Promise<{ spec: Spec; revision: number }> {
    if (this.ended) {
      throw new Error('The Composer session has ended.');
    }
    return this.document.readSpec();
  }

  public applySpec(spec: Spec, opts: ComposerApplyOptions): Promise<ApplyOutcome<Spec>> {
    return this.document.applySpec(spec, opts, () => !this.ended);
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
    this.regions.set(regionId, {
      box: { left: rect.left - rootRect.left, top: rect.top - rootRect.top, width: rect.width, height: rect.height },
      tabKeys,
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
    if (this.ended || this.overlayState.paused || !this.findAnnotation(id)) {
      return;
    }
    this.annotationListeners.forEach((listener) => listener(id));
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
    const rootRect = root.getBoundingClientRect();
    return { ...region.box, left: rootRect.left + region.box.left, top: rootRect.top + region.box.top };
  }

  /** The overlay root: the parent of the anchor host the overlay registers. */
  private getOverlayRoot(): HTMLElement | null {
    return this.anchorHost?.parentElement ?? null;
  }

  private findAnnotation(id: string): ComposerAnnotation | undefined {
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

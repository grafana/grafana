/**
 * The Composer contract between core and Grafana Assistant (restricted API `composer`).
 *
 * The plugin declares these types locally and checks the handle at runtime; only the outer
 * `ComposerAPI` shape is mirrored in `@grafana/data` so the restricted APIs context can carry it.
 */

import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

/** What GET_SPEC / APPLY_SPEC use. */
export type ComposerDashboardSpec = DashboardV2Spec;

/** The document a session edits. Only dashboards are supported so far. */
export interface ComposerTarget {
  resource: 'dashboard' | 'notebook';
  uid: string;
}

export interface ComposerEnterOptions {
  /**
   * 'floating' (the default) floats the extension sidebar over the document for the session, even with
   * `grafana.extensionSidebarFloating` off, and brings back the user's own layout when the session ends.
   * Docking the sidebar during the session ends it. 'none' leaves the sidebar alone.
   */
  presentation?: 'floating' | 'none';
}

export type ComposerEnterCheck = { ok: true } | { ok: false; reason: 'no_document' | 'no_permission' | 'unsupported' };

export interface ComposerAPI {
  readonly version: 1;
  /**
   * Whether Composer can start on `target`, or on the mounted dashboard when it is omitted. 'no_document'
   * when that document is not the one mounted; 'unsupported' for a notebook.
   */
  canEnter(target?: ComposerTarget): ComposerEnterCheck;
  /** Rejects when `canEnter(target)` would not return ok, or another session is open. */
  enter(target?: ComposerTarget, options?: ComposerEnterOptions): Promise<ComposerSessionAPI>;
  /**
   * Called with the target when the user asks for Composer from Grafana's own UI (the dashboard mode
   * picker). A request made while no listener is registered (the Assistant sidebar was closed and is being
   * opened) goes to the first listener that subscribes within 10 seconds; each request is delivered once.
   * Core does not enter Composer itself: the listener calls `enter` as usual. Returns an unsubscribe.
   */
  onEnterRequested(listener: (target: ComposerTarget) => void): () => void;
}

/**
 * Rows and tabs are selectable from M3. Region ids are issued by core with a region pick and live until no
 * annotation references them or the session ends.
 */
export type ElementRef =
  | { kind: 'panel'; panelId: number }
  | { kind: 'row' | 'tab'; name: string }
  | { kind: 'region'; regionId: string }
  /** A dashboard variable, by its name in the spec. */
  | { kind: 'variable'; name: string };

/** A position inside an element, each axis normalised to 0..1 of its bounds. */
export interface ElementPoint {
  x: number;
  y: number;
}

export interface ElementPick {
  ref: Exclude<ElementRef, { kind: 'region' }>;
  label: string;
  /** Titles of the tabs containing the element, outermost first. */
  tabPath: string[];
  /**
   * Where the element was clicked; `{ x: 0, y: 0 }` for picks without a pointer. A variable's pick points
   * at its control's top-right corner, where its pin goes.
   */
  point: ElementPoint;
}

/**
 * A comment marker core draws over the dashboard. It carries no comment text: the plugin renders the
 * editor itself, into the container `getAnnotationAnchor` returns.
 */
export interface ComposerAnnotation {
  id: string;
  ref: ElementRef;
  point: ElementPoint;
  /** Pin text, for example "1". At most 3 characters are shown. */
  label: string;
  /** An active item also outlines its element; a staged one shows only its pin. */
  state: 'active' | 'staged';
}

export interface RegionPick {
  ref: { kind: 'region'; regionId: string };
  /** The localised noun "Region"; the tab context is in `tabPath`. */
  label: string;
  /** 0..1 of the visible dashboard area at release. */
  rect: { x: number; y: number; width: number; height: number };
  /** The pin sits on the region's top-right corner. */
  point: { x: 1; y: 0 };
  tabPath: string[];
  /** Panels and variable controls the region overlaps with a positive area, at most 20. */
  intersects: Array<{ ref: ElementRef; label: string }>;
  timeRange: { from: string; to: string; timezone: string };
}

export type RegionCapture =
  | { status: 'ready'; image: Blob; width: number; height: number; capturedAt: string }
  | { status: 'failed'; reason: 'unsupported' | 'too_large' | 'timeout' | 'busy' | 'not_visible' | 'failed' };

export interface ComposerElement {
  ref: ElementRef;
  label: string;
  tabPath: string[];
}

export type ApplyOutcome =
  | { status: 'applied'; appliedSpec: ComposerDashboardSpec; revision: number }
  | { status: 'aborted' | 'stale' | 'denied' | 'closed' | 'invalid'; message: string };

export interface ComposerSessionAPI {
  readonly target: ComposerTarget;
  /** Aborted on exit, navigation away, scene deactivation or flag-off. */
  readonly signal: AbortSignal;

  /**
   * Resolves with the clicked element, or with a region when the user drags at least 8x8 CSS px while it
   * is pending (a smaller drag stays a click; a press on a tab header switches tabs).
   * Null when cancelled (Escape, `signal`, pause or session end). Cancelling a drag keeps the pick pending.
   */
  pickElement(signal: AbortSignal): Promise<ElementPick | RegionPick | null>;
  /**
   * Draws a region only: a plain click does nothing. Kept for compatibility; `pickElement` draws regions
   * on drag too.
   */
  pickRegion(signal: AbortSignal): Promise<RegionPick | null>;
  /**
   * Renders a region as an image, WebP where the browser encodes it, longest edge at most 1568px. One
   * capture runs at a time ('busy' otherwise), and picking and tab switching wait for it. 'not_visible'
   * unless the region is fully in view on a selected tab (reveal it, then retry); scrolling during a
   * capture also ends it as 'not_visible'. 'too_large' when the dashboard would render past 16 megapixels,
   * 'unsupported' for tainted or cross-origin content, 'timeout' after 10 s (a late result is dropped).
   */
  captureRegion(regionId: string, signal: AbortSignal): Promise<RegionCapture>;
  /** Not supported in M1: returns []. */
  listElements(): ComposerElement[];
  highlight(target: ElementRef | null): void;
  setPaused(paused: boolean): void;

  /**
   * Replaces the drawn annotations. Each is a comment-bubble pin whose tail (its square bottom-left corner)
   * sits on the item's point; active pins are drawn slightly larger. Pins are disabled while paused.
   */
  setAnnotations(items: ComposerAnnotation[]): void;
  /** Fires with the item id when its pin is clicked or activated with Enter or Space. Returns an unsubscribe. */
  onAnnotationClick(listener: (id: string) => void): () => void;
  /**
   * Fires with the item id when a pin gains pointer hover or keyboard focus, and with null when it loses
   * it. Ignored while paused. Returns an unsubscribe.
   */
  onAnnotationHover(listener: (id: string | null) => void): () => void;
  /**
   * A stable, zero-size container for the plugin to portal its editor or a read-only preview into. Works
   * for active and staged items alike. It sits at the pin's visual centre (half a pin right of and above
   * the tail on the item's point, clamped to the viewport), so a popover placed beside it sits beside the
   * pin, and it follows scroll, resize and layout like the pin; it is hidden
   * (`display: none`) while the element is entirely off-screen. Core does no collision handling and never
   * reads, styles or clears its content. Null when the item is not set or does not resolve.
   */
  getAnnotationAnchor(id: string): HTMLElement | null;
  /**
   * Scrolls the item's element into view in the dashboard's scroll container, keeping the pin's point
   * visible. Smooth unless the user prefers reduced motion. No-op for an unknown id, a closed session,
   * or an element in a tab that is not selected (tab switching is M3 navigation).
   */
  revealAnnotation(id: string): void;

  readSpec(): Promise<{ spec: ComposerDashboardSpec; revision: number }>;
  applySpec(spec: ComposerDashboardSpec, opts: { signal: AbortSignal; baseRevision: number }): Promise<ApplyOutcome>;

  /** Leaves Composer. Never saves or discards. */
  exit(): void;
}

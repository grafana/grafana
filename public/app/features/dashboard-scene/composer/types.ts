/**
 * The Composer contract between core and Grafana Assistant (restricted API `composer`).
 *
 * The plugin declares these types locally and checks the handle at runtime; only the outer
 * `ComposerAPI` shape is mirrored in `@grafana/data` so the restricted APIs context can carry it.
 */

import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type Spec as NotebookSpec } from 'app/features/notebook/types';

/** What GET_SPEC / APPLY_SPEC use. */
export type ComposerDashboardSpec = DashboardV2Spec;

/** What GET_NOTEBOOK_SPEC / APPLY_NOTEBOOK_SPEC use. */
type ComposerNotebookSpec = NotebookSpec;

/**
 * The document a session edits: a dashboard, or a notebook on its own route, `/notebooks/:uid`. Notebook
 * targets are refused for now.
 */
export interface ComposerTarget {
  resource: ComposerResource;
  uid: string;
}

/** The document types Composer edits. */
export type ComposerResource = 'dashboard' | 'notebook';

export interface ComposerEnterRequestOptions {
  /**
   * The document types this listener enters Composer on. Grafana offers Composer only for types some live
   * listener supports. Omitted, the listener supports dashboards only.
   */
  resources?: ComposerResource[];
}

interface ComposerEnterOptions {
  /**
   * 'floating' (the default) floats the extension sidebar over the document when the session starts, even
   * with `grafana.extensionSidebarFloating` off. The user may dock it and stay in Composer. When the session
   * ends, the layout from before it comes back, unless the user chose another one since. Closing the
   * sidebar ends the session. 'none' leaves the sidebar alone and does not tie the session to it.
   */
  presentation?: 'floating' | 'none';
}

export type ComposerEnterCheck = { ok: true } | { ok: false; reason: 'no_document' | 'no_permission' | 'unsupported' };

export interface ComposerAPI {
  readonly version: 1;
  /**
   * Whether Composer can start on `target`, or on the mounted dashboard when it is omitted. 'no_document'
   * when that document is not the one mounted. A notebook is supported only on its own route; one rendered
   * anywhere else (the Assistant canvas) is 'unsupported'.
   */
  canEnter(target?: ComposerTarget): ComposerEnterCheck;
  /** Rejects when `canEnter(target)` would not return ok, or another session is open. */
  enter(
    target?: ComposerTarget,
    options?: ComposerEnterOptions
  ): Promise<ComposerSessionAPI | ComposerSessionAPI<ComposerNotebookSpec>>;
  /**
   * Called with the target when the user asks for Composer from Grafana's own UI (the dashboard mode
   * picker, the notebook mode switch). Grafana offers Composer only on the document types in
   * `options.resources` of some live listener (dashboards only when `options` is omitted), and delivers each
   * request once, to the first listener that supports its type. To change the types, unsubscribe and
   * register again.
   * Core does not enter Composer itself: the listener calls `enter` as usual. A listener that will not take
   * a request returns `false`: the request then ends at once (the sidebar goes back to its layout, the
   * picker or switch stops showing it pending) and goes to no other listener. Any other return leaves it
   * outstanding until `enter` settles it or 10 seconds pass. Returns an unsubscribe.
   */
  onEnterRequested(
    listener: (target: ComposerTarget) => boolean | void,
    options?: ComposerEnterRequestOptions
  ): () => void;
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
  | { kind: 'variable'; name: string }
  /**
   * An annotation or another data layer shown in the dashboard controls, by its name. `layerKind` tells an
   * annotation (in the spec's `annotations`) from a data layer Grafana adds itself, such as alert states.
   */
  | { kind: 'annotation'; name: string; layerKind: 'annotation' | 'data-layer' }
  /** A notebook cell, by the `elementName` its layout cell references. */
  | { kind: 'cell'; name: string };

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
   * Where the element was clicked; `{ x: 0, y: 0 }` for picks without a pointer. A variable's or an
   * annotation's pick points at its control's top-right corner, where its pin goes.
   */
  point: ElementPoint;
  /**
   * Whether ⌘ (macOS) or Ctrl was held when the pick was made, for adding the element to the comment that
   * is open instead of starting a new one. Optional, so older handles may leave it out.
   */
  additive?: boolean;
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
  /**
   * Further elements one comment covers (⌘/Ctrl-click). Each is outlined as `ref` is, by its kind and the
   * item's state; the pin stays on `ref`. A ref that does not resolve is left out.
   */
  alsoRefs?: ElementRef[];
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
  /** Panels and variable controls (on a notebook, cells) the region overlaps with a positive area, at most 20. */
  intersects: Array<{ ref: ElementRef; label: string }>;
  timeRange: { from: string; to: string; timezone: string };
  /** Whether ⌘ (macOS) or Ctrl was held when the drag ended: see `ElementPick.additive`. */
  additive?: boolean;
}

export type RegionCapture =
  | { status: 'ready'; image: Blob; width: number; height: number; capturedAt: string }
  | { status: 'failed'; reason: 'unsupported' | 'too_large' | 'timeout' | 'busy' | 'not_visible' | 'failed' };

export interface ComposerElement {
  ref: ElementRef;
  label: string;
  tabPath: string[];
}

export type ApplyOutcome<Spec = ComposerDashboardSpec> =
  | { status: 'applied'; appliedSpec: Spec; revision: number }
  | { status: 'aborted' | 'stale' | 'denied' | 'closed' | 'invalid'; message: string };

export interface ComposerApplyOptions {
  signal: AbortSignal;
  baseRevision: number;
  /**
   * Notebooks only: what to do with panel looks the person reading changed during the session (Undo passes
   * 'discard'). Defaults to 'keep', which is how changes made before entry are resolved too.
   */
  viewOnlyChanges?: 'keep' | 'discard';
}

/**
 * How the one save a notebook session makes on exit ended. 'unchanged' when nothing was left to write.
 * On 'conflict' core also shows the notebook's own conflict prompt, unless the person has navigated away.
 */
interface ComposerSaveOutcome {
  status: 'saved' | 'save_failed' | 'conflict' | 'unchanged';
  /** The autosave's error text: translated for a conflict, the raw API error for a failed save. */
  message?: string;
}

/** What a session reports once it has ended. Dashboards never save, so theirs carries no `save`. */
export interface ComposerExitResult {
  save?: ComposerSaveOutcome;
}

export interface ComposerSessionAPI<Spec = ComposerDashboardSpec> {
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
  /**
   * Paused while the Assistant runs a turn that edits the document: picking and pins are disabled. Turning
   * Composer off, or switching it to Viewing, asks for confirmation while the session is paused, because
   * either stops that turn.
   */
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

  /**
   * The document and its revision. A dashboard's revision counts definition changes; a notebook's counts
   * changes to its edit history (applies, undo, redo), so query refreshes never make a read stale.
   */
  readSpec(): Promise<{ spec: Spec; revision: number }>;
  applySpec(spec: Spec, opts: ComposerApplyOptions): Promise<ApplyOutcome<Spec>>;
  /**
   * Whether the dashboard is in Editing, where Composer writes. Over Viewing, an `applySpec` first switches
   * the dashboard to Editing, as an Assistant edit from Viewing starts Agent editing. False once the
   * session has ended.
   */
  readonly canWrite: boolean;
  /** Fires when `canWrite` changes (Viewing and Editing switched). Returns an unsubscribe. */
  onCanWriteChange(listener: (canWrite: boolean) => void): () => void;

  /**
   * Leaves Composer. A dashboard session never saves or discards and returns nothing. A notebook keeps its
   * autosave paused for the session, so leaving makes the one save of everything applied, and this
   * resolves with its outcome (the same result as `closed`).
   */
  exit(): void | Promise<ComposerExitResult>;
  /**
   * Resolves once, after the session has ended by any path (exit, navigation away, disposal or flag-off)
   * and a notebook's exit save has settled.
   */
  readonly closed: Promise<ComposerExitResult>;
  /**
   * Notebooks only, after the session ended: retries a failed exit save once. A conflict is not retried
   * here (overwriting is the notebook's own conflict prompt), so it resolves with 'conflict' again.
   */
  retrySave?(): Promise<ComposerExitResult>;
}

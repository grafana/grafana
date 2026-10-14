/**
 * The Composer contract between core and Grafana Assistant (restricted API `dashboardComposer`).
 *
 * The plugin declares these types locally and checks the handle at runtime; only the outer
 * `DashboardComposerAPI` shape is mirrored in `@grafana/data` so the restricted APIs context can carry it.
 */

import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

/** What GET_SPEC / APPLY_SPEC use. */
export type ComposerDashboardSpec = DashboardV2Spec;

export type ComposerEnterCheck =
  | { ok: true }
  | { ok: false; reason: 'not_dashboard' | 'no_permission' | 'unsupported' };

export interface DashboardComposerAPI {
  readonly version: 1;
  canEnter(): ComposerEnterCheck;
  /** Rejects when `canEnter()` would not return ok, or another session is open. */
  enter(): Promise<ComposerSessionAPI>;
}

/** Rows and tabs are selectable from M3; M1 resolves panels only. */
export type ElementRef = { kind: 'panel'; panelId: number } | { kind: 'row' | 'tab'; name: string };

/** A position inside an element, each axis normalised to 0..1 of its bounds. */
export interface ElementPoint {
  x: number;
  y: number;
}

export interface ElementPick {
  ref: ElementRef;
  label: string;
  /** Titles of the tabs containing the element, outermost first. */
  tabPath: string[];
  /** Where the element was clicked; `{ x: 0, y: 0 }` for picks without a pointer. */
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
  rect: { x: number; y: number; width: number; height: number };
  tabPath: string[];
  intersects: Array<{ ref: ElementRef; label: string }>;
  timeRange: { from: string; to: string; timezone: string };
  capture:
    | { status: 'ready'; image: Blob; width: number; height: number; capturedAt: string }
    | { status: 'failed'; reason: 'unsupported' | 'too_large' | 'timeout' | 'failed' };
}

export interface ComposerElement {
  ref: ElementRef;
  label: string;
  tabPath: string[];
}

export type ApplyOutcome =
  | { status: 'applied'; appliedSpec: ComposerDashboardSpec; revision: number }
  | { status: 'aborted' | 'stale' | 'denied' | 'closed' | 'invalid'; message: string };

export interface ComposerSessionAPI {
  readonly dashboardUid: string;
  /** Aborted on exit, navigation away, scene deactivation or flag-off. */
  readonly signal: AbortSignal;

  /** Resolves null when cancelled (Escape, `signal`, pause or session end). */
  pickElement(signal: AbortSignal): Promise<ElementPick | null>;
  /** Not supported in M1: resolves null. */
  pickRegion(signal: AbortSignal, start?: PointerEvent): Promise<RegionPick | null>;
  /** Not supported in M1: returns []. */
  listElements(): ComposerElement[];
  highlight(target: ElementRef | null): void;
  setPaused(paused: boolean): void;

  /** Replaces the drawn annotations. Pins are disabled while paused. */
  setAnnotations(items: ComposerAnnotation[]): void;
  /** Fires with the item id when its pin is clicked or activated with Enter or Space. Returns an unsubscribe. */
  onAnnotationClick(listener: (id: string) => void): () => void;
  /**
   * Fires with the item id when a pin gains pointer hover or keyboard focus, and with null when it loses
   * it. Ignored while paused. Returns an unsubscribe.
   */
  onAnnotationHover(listener: (id: string | null) => void): () => void;
  /**
   * A stable container, positioned at the item's element, for the plugin to portal its editor or a
   * read-only preview into. Works for active and staged items alike.
   * Core never reads, styles or clears its content. Null when the item is not set or does not resolve.
   */
  getAnnotationAnchor(id: string): HTMLElement | null;

  readSpec(): Promise<{ spec: ComposerDashboardSpec; revision: number }>;
  applySpec(spec: ComposerDashboardSpec, opts: { signal: AbortSignal; baseRevision: number }): Promise<ApplyOutcome>;

  /** Leaves Composer. Never saves or discards. */
  exit(): void;
}

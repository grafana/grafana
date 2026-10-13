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

export interface ElementPick {
  ref: ElementRef;
  label: string;
  /** Titles of the tabs containing the element, outermost first. */
  tabPath: string[];
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

  readSpec(): Promise<{ spec: ComposerDashboardSpec; revision: number }>;
  applySpec(spec: ComposerDashboardSpec, opts: { signal: AbortSignal; baseRevision: number }): Promise<ApplyOutcome>;

  /** Leaves Composer. Never saves or discards. */
  exit(): void;
}

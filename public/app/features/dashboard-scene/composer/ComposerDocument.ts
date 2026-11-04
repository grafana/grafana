import { type Box } from './composerGeometry';
import {
  type ApplyOutcome,
  type ComposerApplyOptions,
  type ComposerExitResult,
  type ComposerTarget,
  type ElementPick,
  type ElementPoint,
  type ElementRef,
  type RegionPick,
} from './types';

/** What a document tells the session it is bound to. */
export interface ComposerDocumentEvents {
  /** The layout or definition changed, so the overlay re-measures. */
  layoutChanged(): void;
}

/**
 * The per-resource half of a Composer session: how one kind of document is found in the DOM, read,
 * written, and entered and left. `ComposerSession` owns everything the two documents share (picks,
 * regions, pins, anchors, capture), so a strategy only answers questions about its own document.
 *
 * `Session` is the session type the scene's Composer slot holds; kept generic so this module imports no
 * session code.
 */
export interface ComposerDocument<Spec, Session = unknown> {
  readonly target: ComposerTarget;
  /** The DOM roots of pickable elements, which the overlay hit-tests, and the attribute holding their key. */
  readonly elementSelector: string;
  readonly elementKeyAttribute: string;
  /** Whether `exit` resolves with a save outcome. Dashboards never save, so theirs returns nothing. */
  readonly reportsSave: boolean;
  /** The pick hint shown over a pickable element. */
  elementHint(): string;

  /** Puts the scene in its Composer state for `session`. False when the scene refuses. */
  attach(session: Session): boolean;
  /** Subscribes to the document. Returns the teardown. */
  start(events: ComposerDocumentEvents): () => void;
  /** The flag gating this resource; turning it off ends the session. */
  isEnabled(): boolean;
  /** Takes the scene out of its Composer state. The scene then closes the session. */
  detach(): void;
  /** Whether a write may land now. Absent: always, while the session is open. */
  canWrite?(): boolean;
  /** Fires when `canWrite` changes. Returns the unsubscribe. */
  onCanWriteChange?(listener: (canWrite: boolean) => void): () => void;
  /** Runs once the session has closed, whoever closed it. */
  finish(): Promise<ComposerExitResult>;
  retrySave?(): Promise<ComposerExitResult>;

  readSpec(): { spec: Spec; revision: number };
  /** `isOpen` is the session's own state, checked by the write gate together with the document's. */
  applySpec(spec: Spec, opts: ComposerApplyOptions, isOpen: () => boolean): Promise<ApplyOutcome<Spec>>;

  /** The element whose DOM root carries `key` in `elementKeyAttribute`, at `point` inside it. */
  resolveElementPick(key: string, point: ElementPoint): ElementPick | null;
  resolveVariablePick?(key: string): ElementPick | null;
  /** The annotation or data layer whose control has `key`, for documents that show them. */
  resolveAnnotationPick?(key: string): ElementPick | null;
  /** The rendered root of `ref`. `container` is what the overlay covers, null before it mounts. */
  findElementRoot(ref: ElementRef, container: HTMLElement | null): HTMLElement | null;
  /** Whether `ref` is in a part of the document not shown now (a tab not selected), or gone. */
  isHidden(ref: ElementRef): boolean;
  /** Where a region drawn now sits: the selected tabs and the time range. */
  regionContext(): { tabKeys: string[]; tabPath: string[]; timeRange: RegionPick['timeRange'] };
  /** Whether a region drawn with `tabKeys` selected shows now. */
  isRegionShown(tabKeys: string[]): boolean;
  /** Elements `rect` (viewport coordinates) overlaps with a positive area, at most 20. */
  findIntersectingElements(rect: Box, container: HTMLElement | null): Array<{ ref: ElementRef; label: string }>;
  /** The element a region capture renders from: the smallest one under `container` holding `rect`. */
  findCaptureRoot(rect: Box, container: HTMLElement): HTMLElement;
}

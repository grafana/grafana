import { type Unsubscribable } from 'rxjs';

import { type SceneObject } from '@grafana/scenes';

import { DashboardInteractions } from '../../utils/interactions';
import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';
import { RowItem } from '../layout-rows/RowItem';
import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';
import { TabItem } from '../layout-tabs/TabItem';
import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';

import { isUnifiedDragAndDropEnabled } from './unifiedDragAndDrop';

export type DragKind = 'panel' | 'row' | 'tab' | 'new_panel' | 'pasted_panel';
export type DragLayoutType = 'custom_grid' | 'auto_grid' | 'rows' | 'tabs' | 'row' | 'tab' | 'none';
export type DragOutcome = 'drop' | 'cancel' | 'no_op';

/** How long after a drop an undo counts as undoing the drop */
export const DRAG_UNDO_WINDOW_MS = 10_000;
/**
 * How long after the drag ends its edit may still arrive: some drops are committed a frame or a promise later.
 * An edit after that is something else the user did.
 */
const DROP_COMMIT_WINDOW_MS = 1_000;
/** Same as the drag threshold of the drag sessions: a press on a header that never moved is a click */
const DRAG_THRESHOLD_PX = 4;

export interface DragEndedReport {
  kind: DragKind;
  sourceLayout: DragLayoutType;
  targetLayout: DragLayoutType;
  outcome: DragOutcome;
  durationMs: number;
  /** Pointer moves during the drag */
  moves: number;
  /** Whether the drop was undone within `DRAG_UNDO_WINDOW_MS` */
  undone: boolean;
}

interface EditHistoryState {
  undoStack: readonly unknown[];
  redoStack: readonly unknown[];
}

/** The dashboard's undo history, which tells whether a drag changed anything and whether that was undone */
export interface EditHistory {
  state: EditHistoryState;
  subscribeToState(handler: (state: EditHistoryState) => void): Unsubscribable;
}

/** Only one drag at a time, so a drag that starts reports the one before it */
let pending: DragTelemetry | null = null;

/**
 * Counts one drag on the unified drag and drop engine, and reports it once it is clear whether the drop was undone:
 * after `DRAG_UNDO_WINDOW_MS`, on the undo, or when the next drag starts. Numbers and layout types only, nothing
 * that identifies the dashboard, its panels or the user.
 *
 * Whether the drag dropped anything is read from the undo history rather than told by the drag: every drop is one
 * undoable edit, and a drag that changes nothing adds none.
 */
export class DragTelemetry {
  private _startTime = performance.now();
  private _durationMs = 0;
  private _moves = 0;
  private _isActive = false;
  private _origin: { x: number; y: number } | null;
  private _undoTopAtStart: unknown;
  private _dropEdit: unknown;
  private _hasEnded = false;
  private _endTime = 0;
  private _targetLayout: DragLayoutType = 'none';
  private _isCancelled = false;
  private _historySub: Unsubscribable | undefined;
  private _timer: ReturnType<typeof setTimeout> | undefined;
  private _isReported = false;

  private constructor(
    private readonly _kind: DragKind,
    private readonly _sourceLayout: DragLayoutType,
    private readonly _history: EditHistory | undefined,
    origin: { x: number; y: number } | null
  ) {
    this._origin = origin;
    this._undoTopAtStart = lastOf(_history?.state.undoStack);
  }

  /**
   * Starts counting a drag, or returns null with the unified drag and drop flag off. `origin` is where the pointer
   * was pressed: a drag only counts once the pointer moved from there. Without it, the drag counts from the start.
   */
  public static start(
    kind: DragKind,
    source: SceneObject | null,
    history: EditHistory | undefined,
    origin?: { x: number; y: number }
  ): DragTelemetry | null {
    if (!isUnifiedDragAndDropEnabled()) {
      return null;
    }
    flushDragTelemetry();
    return new DragTelemetry(kind, getDragLayoutType(source), history, origin ?? null);
  }

  public move(x: number, y: number) {
    this._moves++;
    if (!this._origin) {
      this._isActive = true;
      return;
    }
    if (!this._isActive && Math.hypot(x - this._origin.x, y - this._origin.y) >= DRAG_THRESHOLD_PX) {
      this._isActive = true;
    }
  }

  /**
   * The drag ended, released over `target`, or cancelled (Escape, a release outside the window). A drag that never
   * moved far enough to be a drag is not reported.
   */
  public end(target: SceneObject | null, { isCancelled = false } = {}) {
    if (this._hasEnded) {
      return;
    }
    this._hasEnded = true;
    this._endTime = performance.now();
    this._durationMs = this._endTime - this._startTime;
    if (!this._isActive && this._origin) {
      return;
    }
    this._targetLayout = isCancelled ? 'none' : getDragLayoutType(target);
    this._isCancelled = isCancelled;
    if (isCancelled) {
      this._report();
      return;
    }

    pending = this;
    this._historySub = this._history?.subscribeToState((state) => this._onHistoryChange(state));
    this._timer = setTimeout(() => this._report(), DRAG_UNDO_WINDOW_MS);
    if (this._history) {
      this._onHistoryChange(this._history.state);
    }
  }

  /** Reports now, e.g. because the dashboard is closed */
  public flush() {
    if (this._hasEnded) {
      this._report();
    }
  }

  private _onHistoryChange({ undoStack, redoStack }: EditHistoryState) {
    if (this._dropEdit === undefined) {
      const top = lastOf(undoStack);
      if (
        top !== undefined &&
        top !== this._undoTopAtStart &&
        performance.now() - this._endTime <= DROP_COMMIT_WINDOW_MS
      ) {
        this._dropEdit = top;
      }
      return;
    }
    if (lastOf(redoStack) === this._dropEdit) {
      this._report(true);
    }
  }

  private _report(undone = false) {
    if (this._isReported) {
      return;
    }
    this._isReported = true;
    this._historySub?.unsubscribe();
    clearTimeout(this._timer);
    if (pending === this) {
      pending = null;
    }

    const outcome: DragOutcome = this._isCancelled ? 'cancel' : this._dropEdit !== undefined ? 'drop' : 'no_op';
    const report: DragEndedReport = {
      kind: this._kind,
      sourceLayout: this._sourceLayout,
      targetLayout: this._targetLayout,
      outcome,
      durationMs: Math.round(this._durationMs),
      moves: this._moves,
      undone,
    };
    DashboardInteractions.dragEnded(report);
  }
}

/** Reports the drag that waits to see whether its drop is undone, if any */
export function flushDragTelemetry() {
  pending?.flush();
}

export function getDragLayoutType(obj: SceneObject | null | undefined): DragLayoutType {
  if (obj instanceof DefaultGridLayoutManager) {
    return 'custom_grid';
  }
  if (obj instanceof AutoGridLayoutManager) {
    return 'auto_grid';
  }
  if (obj instanceof RowsLayoutManager) {
    return 'rows';
  }
  if (obj instanceof TabsLayoutManager) {
    return 'tabs';
  }
  if (obj instanceof RowItem) {
    return 'row';
  }
  if (obj instanceof TabItem) {
    return 'tab';
  }
  return 'none';
}

function lastOf(list: readonly unknown[] | undefined): unknown {
  return list && list.length > 0 ? list[list.length - 1] : undefined;
}

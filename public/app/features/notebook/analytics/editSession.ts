import {
  NOTEBOOK_EDIT_KIND,
  type NotebookEditHistoryObserver,
  type NotebookEditKind,
} from '../scene/NotebookEditHistory';

export interface NotebookEditSessionTotals {
  durationMs: number;
  editCount: number;
  cellsAdded: number;
  cellsRemoved: number;
  cellsMoved: number;
  undoCount: number;
  redoCount: number;
  timeRangeChanged: boolean;
}

/**
 * Totals for one edit session, from entering edit mode to leaving it.
 *
 * Counted here rather than read off NotebookEditHistory, which cannot answer this: its undo stack
 * drops the oldest action once it holds 100, and swapping the notebook's body clears both stacks, so
 * its length is a count of what can still be undone rather than of what somebody did.
 *
 * Counting here also means no call site has to report anything. Every mutation already goes through
 * the history, and the history only records an action the first time it runs, so a redo cannot count
 * twice.
 */
export class NotebookEditSession implements NotebookEditHistoryObserver {
  private startedAt = 0;
  private editCount = 0;
  private cellsAdded = 0;
  private cellsRemoved = 0;
  private cellsMoved = 0;
  private undoCount = 0;
  private redoCount = 0;
  private timeRangeChanged = false;

  public start(): void {
    this.startedAt = Date.now();
    this.editCount = 0;
    this.cellsAdded = 0;
    this.cellsRemoved = 0;
    this.cellsMoved = 0;
    this.undoCount = 0;
    this.redoCount = 0;
    this.timeRangeChanged = false;
  }

  /** Reads the totals and clears them, so the next session starts from nothing. */
  public end(): NotebookEditSessionTotals {
    const totals: NotebookEditSessionTotals = {
      durationMs: Date.now() - this.startedAt,
      editCount: this.editCount,
      cellsAdded: this.cellsAdded,
      cellsRemoved: this.cellsRemoved,
      cellsMoved: this.cellsMoved,
      undoCount: this.undoCount,
      redoCount: this.redoCount,
      timeRangeChanged: this.timeRangeChanged,
    };

    this.start();
    return totals;
  }

  /**
   * The time range moved while editing. A flag rather than a count, because the controls commit a
   * change per arrow press and per zoom, and counting those would measure how someone reached a
   * range rather than whether they changed it.
   */
  public onTimeRangeChanged(): void {
    this.timeRangeChanged = true;
  }

  public onRecord(kind: NotebookEditKind): void {
    this.editCount++;

    if (kind === NOTEBOOK_EDIT_KIND.ADD_CELL) {
      this.cellsAdded++;
    } else if (kind === NOTEBOOK_EDIT_KIND.REMOVE_CELL) {
      this.cellsRemoved++;
    } else if (kind === NOTEBOOK_EDIT_KIND.MOVE_CELL) {
      this.cellsMoved++;
    }
  }

  /**
   * The session counts undo and redo rather than sending an event per step. Holding the key
   * auto-repeats, so one gesture can walk the whole stack.
   */
  public onUndo(): void {
    this.undoCount++;
  }

  public onRedo(): void {
    this.redoCount++;
  }

  /**
   * An edit that was rolled back before it stood, so it is not one the person made.
   *
   * Only the content and query edits are ever discarded, and both are `EDIT`, so there is no cell
   * count to walk back here.
   */
  public onDiscard(): void {
    if (this.editCount > 0) {
      this.editCount--;
    }
  }
}

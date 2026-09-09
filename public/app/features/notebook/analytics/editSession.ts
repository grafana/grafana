import { type NotebookEditHistoryObserver } from '../scene/NotebookEditHistory';

export interface NotebookEditSessionTotals {
  durationMs: number;
  editCount: number;
}

/**
 * Totals for one edit session, from entering edit mode to leaving it.
 *
 * Counted here rather than read off NotebookEditHistory, which cannot answer this: its undo stack
 * drops the oldest action once it holds 100, and swapping the notebook's body clears both stacks, so
 * its length is a count of what can still be undone rather than of what somebody did.
 */
export class NotebookEditSession implements NotebookEditHistoryObserver {
  private startedAt = 0;
  private editCount = 0;

  public start(): void {
    this.startedAt = Date.now();
    this.editCount = 0;
  }

  /** Reads the totals and clears them, so the next session starts from nothing. */
  public end(): NotebookEditSessionTotals {
    const totals: NotebookEditSessionTotals = {
      durationMs: Date.now() - this.startedAt,
      editCount: this.editCount,
    };

    this.start();
    return totals;
  }

  public onRecord(): void {
    this.editCount++;
  }

  /** An edit that was rolled back before it stood, so it is not one the person made. */
  public onDiscard(): void {
    if (this.editCount > 0) {
      this.editCount--;
    }
  }
}

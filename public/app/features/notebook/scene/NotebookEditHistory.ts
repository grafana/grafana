import { StateManagerBase } from 'app/core/services/StateManagerBase';

const MAX_HISTORY_LENGTH = 100;

/**
 * What an action did to the notebook, for counting one editing session's activity.
 *
 * Separate from `label` for two reasons. `t()` translates a label, so counting on one breaks outside
 * English. The labels also disagree with themselves. The "/" menu records "Add block" for
 * Visualization and "Edit block" for Heading, on the same gesture on the same empty slot.
 *
 * `ADD_CELL` means a new cell went into the layout. Changing a cell that is already there is `EDIT`,
 * however much it changes.
 */
export const NOTEBOOK_EDIT_KIND = {
  ADD_CELL: 'add-cell',
  REMOVE_CELL: 'remove-cell',
  MOVE_CELL: 'move-cell',
  EDIT: 'edit',
} as const;

export type NotebookEditKind = (typeof NOTEBOOK_EDIT_KIND)[keyof typeof NOTEBOOK_EDIT_KIND];

export interface NotebookEditAction {
  label: string;
  kind: NotebookEditKind;
  perform: () => void;
  undo: () => void;
}

export interface NotebookEditHistoryState {
  canUndo: boolean;
  canRedo: boolean;
  undoLabel?: string;
  redoLabel?: string;
}

/**
 * Told when an action is recorded or rolled back, so that something outside can count edits.
 *
 * The stacks themselves cannot be counted: `record` drops the oldest action once the undo stack is
 * full, and `clear` empties both.
 */
export interface NotebookEditHistoryObserver {
  onRecord(kind: NotebookEditKind): void;
  onDiscard(): void;
}

export class NotebookEditHistory extends StateManagerBase<NotebookEditHistoryState> {
  private undoStack: NotebookEditAction[] = [];
  private redoStack: NotebookEditAction[] = [];
  private redoStackBeforeRecord = new WeakMap<NotebookEditAction, NotebookEditAction[]>();

  public constructor(private readonly observer?: NotebookEditHistoryObserver) {
    super({ canUndo: false, canRedo: false });
  }

  public execute(action: NotebookEditAction): void {
    action.perform();
    this.record(action);
  }

  public record(action: NotebookEditAction): void {
    this.redoStackBeforeRecord.set(action, this.redoStack);
    this.undoStack.push(action);
    if (this.undoStack.length > MAX_HISTORY_LENGTH) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.observer?.onRecord(action.kind);
    this.publishState();
  }

  public discard(action: NotebookEditAction): void {
    if (this.undoStack.at(-1) !== action) {
      return;
    }

    this.undoStack.pop();
    this.redoStack = this.redoStackBeforeRecord.get(action) ?? this.redoStack;
    this.redoStackBeforeRecord.delete(action);
    this.observer?.onDiscard();
    this.publishState();
  }

  public undo(): boolean {
    const action = this.undoStack.at(-1);
    if (!action) {
      return false;
    }

    action.undo();
    this.undoStack.pop();
    this.redoStack.push(action);
    this.publishState();
    return true;
  }

  public redo(): boolean {
    const action = this.redoStack.at(-1);
    if (!action) {
      return false;
    }

    action.perform();
    this.redoStack.pop();
    this.undoStack.push(action);
    this.publishState();
    return true;
  }

  public clear(): void {
    if (this.undoStack.length === 0 && this.redoStack.length === 0) {
      return;
    }

    this.undoStack = [];
    this.redoStack = [];
    this.publishState();
  }

  private publishState(): void {
    this.setState({
      canUndo: this.undoStack.length > 0,
      canRedo: this.redoStack.length > 0,
      undoLabel: this.undoStack.at(-1)?.label,
      redoLabel: this.redoStack.at(-1)?.label,
    });
  }
}

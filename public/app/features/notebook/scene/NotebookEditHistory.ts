import { StateManagerBase } from 'app/core/services/StateManagerBase';

const MAX_HISTORY_LENGTH = 100;

export interface NotebookEditAction {
  label: string;
  perform: () => void;
  undo: () => void;
}

export interface NotebookEditHistoryState {
  canUndo: boolean;
  canRedo: boolean;
  undoLabel?: string;
  redoLabel?: string;
}

export class NotebookEditHistory extends StateManagerBase<NotebookEditHistoryState> {
  private undoStack: NotebookEditAction[] = [];
  private redoStack: NotebookEditAction[] = [];
  private redoStackBeforeRecord = new WeakMap<NotebookEditAction, NotebookEditAction[]>();

  public constructor() {
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
    this.publishState();
  }

  public discard(action: NotebookEditAction): void {
    if (this.undoStack.at(-1) !== action) {
      return;
    }

    this.undoStack.pop();
    this.redoStack = this.redoStackBeforeRecord.get(action) ?? this.redoStack;
    this.redoStackBeforeRecord.delete(action);
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

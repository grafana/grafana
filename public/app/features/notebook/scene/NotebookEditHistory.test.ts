import { NOTEBOOK_EDIT_KIND, NotebookEditHistory } from './NotebookEditHistory';

describe('NotebookEditHistory', () => {
  it('executes, undoes, and redoes an action', () => {
    const history = new NotebookEditHistory();
    let value = 0;

    history.execute({
      label: 'change value',
      kind: NOTEBOOK_EDIT_KIND.EDIT,
      perform: () => {
        value = 1;
      },
      undo: () => {
        value = 0;
      },
    });

    expect(value).toBe(1);
    expect(history.state).toEqual({ canUndo: true, canRedo: false, undoLabel: 'change value' });

    expect(history.undo()).toBe(true);
    expect(value).toBe(0);
    expect(history.state).toEqual({ canUndo: false, canRedo: true, redoLabel: 'change value' });

    expect(history.redo()).toBe(true);
    expect(value).toBe(1);
    expect(history.state).toEqual({ canUndo: true, canRedo: false, undoLabel: 'change value' });
  });

  it('records an already-applied editor transaction without applying it twice', () => {
    const history = new NotebookEditHistory();
    const perform = jest.fn();
    const undo = jest.fn();

    history.record({ label: 'edit code', kind: NOTEBOOK_EDIT_KIND.EDIT, perform, undo });

    expect(perform).not.toHaveBeenCalled();
    history.undo();
    history.redo();
    expect(undo).toHaveBeenCalledTimes(1);
    expect(perform).toHaveBeenCalledTimes(1);
  });

  it('clears redo history when a new edit is recorded', () => {
    const history = new NotebookEditHistory();
    const action = (label: string) => ({ label, kind: NOTEBOOK_EDIT_KIND.EDIT, perform: jest.fn(), undo: jest.fn() });

    history.execute(action('first'));
    history.undo();
    history.execute(action('second'));

    expect(history.state).toEqual({ canUndo: true, canRedo: false, undoLabel: 'second', redoLabel: undefined });
    expect(history.redo()).toBe(false);
  });

  it('discards a live transaction that returned to its starting value', () => {
    const history = new NotebookEditHistory();
    const action = { label: 'edit code', kind: NOTEBOOK_EDIT_KIND.EDIT, perform: jest.fn(), undo: jest.fn() };

    history.record(action);
    history.discard(action);

    expect(history.state.canUndo).toBe(false);
    expect(history.undo()).toBe(false);
  });

  it('restores redo history when a live transaction is discarded', () => {
    const history = new NotebookEditHistory();
    const original = { label: 'add block', kind: NOTEBOOK_EDIT_KIND.ADD_CELL, perform: jest.fn(), undo: jest.fn() };
    const transient = { label: 'edit code', kind: NOTEBOOK_EDIT_KIND.EDIT, perform: jest.fn(), undo: jest.fn() };

    history.execute(original);
    history.undo();
    history.record(transient);
    history.discard(transient);

    expect(history.state).toEqual({ canUndo: false, canRedo: true, undoLabel: undefined, redoLabel: 'add block' });
    expect(history.redo()).toBe(true);
    expect(original.perform).toHaveBeenCalledTimes(2);
  });

  it('removes a failed action below a newer edit without losing the newer edit', () => {
    const history = new NotebookEditHistory();
    const failed = {
      label: 'change visualization',
      kind: NOTEBOOK_EDIT_KIND.EDIT,
      perform: jest.fn(),
      undo: jest.fn(),
    };
    const newer = { label: 'rename panel', kind: NOTEBOOK_EDIT_KIND.EDIT, perform: jest.fn(), undo: jest.fn() };

    history.record(failed);
    history.execute(newer);
    history.discard(failed);

    expect(history.state.undoLabel).toBe('rename panel');
    expect(history.undo()).toBe(true);
    expect(newer.undo).toHaveBeenCalledTimes(1);
    expect(history.undo()).toBe(false);
    expect(failed.undo).not.toHaveBeenCalled();
  });

  it('removes a failed action after it was moved to redo history', () => {
    const history = new NotebookEditHistory();
    const failed = {
      label: 'change visualization',
      kind: NOTEBOOK_EDIT_KIND.EDIT,
      perform: jest.fn(),
      undo: jest.fn(),
    };

    history.record(failed);
    history.undo();
    history.discard(failed);

    expect(history.redo()).toBe(false);
    expect(failed.perform).not.toHaveBeenCalled();
  });

  it('keeps newer redo history when a failed action becomes the undo stack top', () => {
    const history = new NotebookEditHistory();
    const failed = {
      label: 'change visualization',
      kind: NOTEBOOK_EDIT_KIND.EDIT,
      perform: jest.fn(),
      undo: jest.fn(),
    };
    const newer = { label: 'rename panel', kind: NOTEBOOK_EDIT_KIND.EDIT, perform: jest.fn(), undo: jest.fn() };

    history.record(failed);
    history.execute(newer);
    history.undo();
    history.discard(failed);

    expect(history.redo()).toBe(true);
    expect(newer.perform).toHaveBeenCalledTimes(2);
    expect(failed.perform).not.toHaveBeenCalled();
  });

  it('keeps an action available when undo fails', () => {
    const history = new NotebookEditHistory();
    history.execute({
      label: 'failing edit',
      kind: NOTEBOOK_EDIT_KIND.EDIT,
      perform: jest.fn(),
      undo: () => {
        throw new Error('undo failed');
      },
    });

    expect(() => history.undo()).toThrow('undo failed');
    expect(history.state).toEqual({ canUndo: true, canRedo: false, undoLabel: 'failing edit' });
  });

  it('caps retained undo history', () => {
    const history = new NotebookEditHistory();
    const undone: number[] = [];

    for (let index = 0; index < 101; index++) {
      history.execute({
        label: String(index),
        kind: NOTEBOOK_EDIT_KIND.EDIT,
        perform: jest.fn(),
        undo: () => undone.push(index),
      });
    }

    while (history.undo()) {}

    expect(undone).toHaveLength(100);
    expect(undone.at(-1)).toBe(1);
  });
});

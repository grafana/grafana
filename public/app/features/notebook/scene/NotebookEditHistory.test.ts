import { NotebookEditHistory } from './NotebookEditHistory';

describe('NotebookEditHistory', () => {
  it('executes, undoes, and redoes an action', () => {
    const history = new NotebookEditHistory();
    let value = 0;

    history.execute({
      label: 'change value',
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

    history.record({ label: 'edit code', perform, undo });

    expect(perform).not.toHaveBeenCalled();
    history.undo();
    history.redo();
    expect(undo).toHaveBeenCalledTimes(1);
    expect(perform).toHaveBeenCalledTimes(1);
  });

  it('clears redo history when a new edit is recorded', () => {
    const history = new NotebookEditHistory();
    const action = (label: string) => ({ label, perform: jest.fn(), undo: jest.fn() });

    history.execute(action('first'));
    history.undo();
    history.execute(action('second'));

    expect(history.state).toEqual({ canUndo: true, canRedo: false, undoLabel: 'second', redoLabel: undefined });
    expect(history.redo()).toBe(false);
  });

  it('discards a live transaction that returned to its starting value', () => {
    const history = new NotebookEditHistory();
    const action = { label: 'edit code', perform: jest.fn(), undo: jest.fn() };

    history.record(action);
    history.discard(action);

    expect(history.state.canUndo).toBe(false);
    expect(history.undo()).toBe(false);
  });

  it('restores redo history when a live transaction is discarded', () => {
    const history = new NotebookEditHistory();
    const original = { label: 'add block', perform: jest.fn(), undo: jest.fn() };
    const transient = { label: 'edit code', perform: jest.fn(), undo: jest.fn() };

    history.execute(original);
    history.undo();
    history.record(transient);
    history.discard(transient);

    expect(history.state).toEqual({ canUndo: false, canRedo: true, undoLabel: undefined, redoLabel: 'add block' });
    expect(history.redo()).toBe(true);
    expect(original.perform).toHaveBeenCalledTimes(2);
  });

  it('keeps an action available when undo fails', () => {
    const history = new NotebookEditHistory();
    history.execute({
      label: 'failing edit',
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
      history.execute({ label: String(index), perform: jest.fn(), undo: () => undone.push(index) });
    }

    while (history.undo()) {}

    expect(undone).toHaveLength(100);
    expect(undone.at(-1)).toBe(1);
  });
});

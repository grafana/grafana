import { NOTEBOOK_EDIT_KIND, NotebookEditHistory, type NotebookEditKind } from '../scene/NotebookEditHistory';

import { NotebookEditSession } from './editSession';

function edit(
  label: string,
  kind: NotebookEditKind = NOTEBOOK_EDIT_KIND.EDIT
): Parameters<NotebookEditHistory['execute']>[0] {
  return { label, kind, perform: jest.fn(), undo: jest.fn() };
}

describe('NotebookEditSession', () => {
  it('counts every edit, including ones the undo stack no longer retains', () => {
    const session = new NotebookEditSession();
    const history = new NotebookEditHistory(session);
    session.start();

    for (let index = 0; index < 101; index++) {
      history.execute(edit(String(index)));
    }

    let undoable = 0;
    while (history.undo()) {
      undoable++;
    }

    expect(undoable).toBe(100);
    expect(session.end().editCount).toBe(101);
  });

  it('keeps its count when the history is cleared', () => {
    const session = new NotebookEditSession();
    const history = new NotebookEditHistory(session);
    session.start();

    history.execute(edit('first'));
    history.execute(edit('second'));
    history.clear();
    history.execute(edit('after the swap'));

    expect(history.state.canUndo).toBe(true);
    expect(session.end().editCount).toBe(3);
  });

  it('drops an edit that was rolled back before it stood', () => {
    const session = new NotebookEditSession();
    const history = new NotebookEditHistory(session);
    session.start();

    const reverted = edit('typing');
    history.execute(edit('kept'));
    history.execute(reverted);
    history.discard(reverted);

    expect(session.end().editCount).toBe(1);
  });

  it('starts the next session from nothing', () => {
    const session = new NotebookEditSession();
    session.start();

    session.onRecord(NOTEBOOK_EDIT_KIND.EDIT);
    session.end();

    expect(session.end().editCount).toBe(0);
  });

  it('counts what the session did to the cells, by kind', () => {
    const session = new NotebookEditSession();
    const history = new NotebookEditHistory(session);
    session.start();

    history.execute(edit('Add block', NOTEBOOK_EDIT_KIND.ADD_CELL));
    history.execute(edit('Split block', NOTEBOOK_EDIT_KIND.ADD_CELL));
    history.execute(edit('Delete block', NOTEBOOK_EDIT_KIND.REMOVE_CELL));
    history.execute(edit('Move block', NOTEBOOK_EDIT_KIND.MOVE_CELL));
    history.execute(edit('Edit block'));

    expect(session.end()).toMatchObject({ cellsAdded: 2, cellsRemoved: 1, cellsMoved: 1, editCount: 5 });
  });

  // Undo does not take the cell count back down, so the action stays counted. Same rule as
  // editCount: the person did it. undoCount is what says they undid it.
  it('keeps counting a cell that was added and then undone', () => {
    const session = new NotebookEditSession();
    const history = new NotebookEditHistory(session);
    session.start();

    history.execute(edit('Add block', NOTEBOOK_EDIT_KIND.ADD_CELL));
    history.undo();

    expect(session.end().cellsAdded).toBe(1);
  });

  // Redo replays `perform` but never records again, so nothing has to guard against it.
  it('counts a redone cell once', () => {
    const session = new NotebookEditSession();
    const history = new NotebookEditHistory(session);
    session.start();

    history.execute(edit('Add block', NOTEBOOK_EDIT_KIND.ADD_CELL));
    history.undo();
    history.redo();

    expect(session.end().cellsAdded).toBe(1);
  });

  it('starts the next session from nothing on every count', () => {
    const session = new NotebookEditSession();
    const history = new NotebookEditHistory(session);
    session.start();

    history.execute(edit('Add block', NOTEBOOK_EDIT_KIND.ADD_CELL));
    history.undo();
    history.redo();
    session.end();

    expect(session.end()).toMatchObject({
      cellsAdded: 0,
      cellsRemoved: 0,
      cellsMoved: 0,
      undoCount: 0,
      redoCount: 0,
    });
  });

  it('counts the undo and redo steps', () => {
    const session = new NotebookEditSession();
    const history = new NotebookEditHistory(session);
    session.start();

    history.execute(edit('Add block', NOTEBOOK_EDIT_KIND.ADD_CELL));
    history.execute(edit('Edit block'));
    history.undo();
    history.undo();
    history.redo();

    expect(session.end()).toMatchObject({ undoCount: 2, redoCount: 1 });
  });

  it('counts nothing for an undo with an empty stack', () => {
    const session = new NotebookEditSession();
    const history = new NotebookEditHistory(session);
    session.start();

    expect(history.undo()).toBe(false);
    expect(history.redo()).toBe(false);
    expect(session.end()).toMatchObject({ undoCount: 0, redoCount: 0 });
  });

  it('counts nothing for an undo that threw, since the notebook did not change', () => {
    const session = new NotebookEditSession();
    const history = new NotebookEditHistory(session);
    session.start();

    history.execute({
      label: 'failing edit',
      kind: NOTEBOOK_EDIT_KIND.EDIT,
      perform: jest.fn(),
      undo: () => {
        throw new Error('undo failed');
      },
    });

    expect(() => history.undo()).toThrow('undo failed');
    expect(session.end().undoCount).toBe(0);
  });

  it('reports whether the time range moved, once however many times it moved', () => {
    const session = new NotebookEditSession();
    session.start();

    session.onTimeRangeChanged();
    session.onTimeRangeChanged();

    expect(session.end().timeRangeChanged).toBe(true);
  });

  it('reports no time range change for a session that did not touch it', () => {
    const session = new NotebookEditSession();
    session.start();

    expect(session.end().timeRangeChanged).toBe(false);
  });

  it('reports how long the session lasted', () => {
    jest.useFakeTimers();
    const session = new NotebookEditSession();

    session.start();
    jest.advanceTimersByTime(5000);

    expect(session.end().durationMs).toBe(5000);
    jest.useRealTimers();
  });
});

import { NotebookEditHistory } from '../scene/NotebookEditHistory';

import { NotebookEditSession } from './editSession';

function edit(label: string): Parameters<NotebookEditHistory['execute']>[0] {
  return { label, perform: jest.fn(), undo: jest.fn() };
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

    session.onRecord();
    session.end();

    expect(session.end().editCount).toBe(0);
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

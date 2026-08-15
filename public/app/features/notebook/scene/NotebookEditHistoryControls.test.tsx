import { act, fireEvent, render, screen } from 'test/test-utils';

import { NotebookEditHistory } from './NotebookEditHistory';
import { NotebookEditHistoryControls } from './NotebookEditHistoryControls';

describe('NotebookEditHistoryControls', () => {
  function setup(enabled = true) {
    const history = new NotebookEditHistory();
    const value = { current: 0 };
    const rendered = render(<NotebookEditHistoryControls history={history} enabled={enabled} />);

    act(() => {
      history.execute({
        label: 'Edit block',
        perform: () => {
          value.current = 1;
        },
        undo: () => {
          value.current = 0;
        },
      });
    });

    return { history, value, ...rendered };
  }

  it('offers the next undo and redo actions', async () => {
    const { user, value } = setup();

    await user.click(screen.getByRole('button', { name: 'Undo: Edit block' }));
    expect(value.current).toBe(0);

    await user.click(screen.getByRole('button', { name: 'Redo: Edit block' }));
    expect(value.current).toBe(1);
  });

  it('supports platform undo and redo shortcuts', () => {
    const { value } = setup();

    fireEvent.keyDown(document, { key: 'z', metaKey: true });
    expect(value.current).toBe(0);

    fireEvent.keyDown(document, { key: 'z', metaKey: true, shiftKey: true });
    expect(value.current).toBe(1);
  });

  it('leaves undo shortcuts to focused editors and inputs', () => {
    const { value } = setup();
    const input = document.createElement('textarea');
    document.body.appendChild(input);

    fireEvent.keyDown(input, { key: 'z', metaKey: true });

    expect(value.current).toBe(1);
    input.remove();
  });

  it('does not register shortcuts outside edit mode', () => {
    const { value } = setup(false);

    fireEvent.keyDown(document, { key: 'z', metaKey: true });

    expect(value.current).toBe(1);
    expect(screen.queryByRole('button', { name: /Undo/ })).not.toBeInTheDocument();
  });
});

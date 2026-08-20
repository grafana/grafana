import { act, fireEvent, render, screen } from 'test/test-utils';

import { NotebookEditHistory } from './NotebookEditHistory';
import { NotebookEditHistoryControls } from './NotebookEditHistoryControls';

describe('NotebookEditHistoryControls', () => {
  const appended: Element[] = [];

  afterEach(() => {
    appended.splice(0).forEach((element) => element.remove());
  });

  function setup() {
    const history = new NotebookEditHistory();
    const value = { current: 0 };
    const rendered = render(<NotebookEditHistoryControls history={history} />);

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

  /** The shape CodeMirror renders: a contenteditable node inside a `.cm-editor` wrapper. */
  function appendCodeEditor() {
    const editor = document.createElement('div');
    editor.className = 'cm-editor';
    const content = document.createElement('div');
    content.contentEditable = 'true';
    editor.appendChild(content);
    document.body.appendChild(editor);
    appended.push(editor);

    return content;
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
    appended.push(input);

    fireEvent.keyDown(input, { key: 'z', metaKey: true });

    expect(value.current).toBe(1);
  });

  it('routes CodeMirror shortcuts through notebook history', () => {
    const { value } = setup();
    const content = appendCodeEditor();

    fireEvent.keyDown(content, { key: 'z', metaKey: true });
    expect(value.current).toBe(0);
    expect(screen.getByRole('button', { name: 'Redo: Edit block' })).toBeEnabled();

    fireEvent.keyDown(content, { key: 'z', metaKey: true, shiftKey: true });
    expect(value.current).toBe(1);
  });

  // Code cells have CodeMirror's own history off, so an undo the notebook cannot serve must still not
  // reach the browser: its contenteditable undo would rewrite the cell behind the notebook's back.
  it('keeps the browser out of undo inside a code cell when nothing is left to undo', () => {
    const { history } = setup();
    const content = appendCodeEditor();
    act(() => {
      history.undo();
    });

    const event = new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true, cancelable: true });
    content.dispatchEvent(event);

    expect(history.state.canUndo).toBe(false);
    expect(event.defaultPrevented).toBe(true);
  });
});

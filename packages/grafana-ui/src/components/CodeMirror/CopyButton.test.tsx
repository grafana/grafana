import { EditorView } from '@codemirror/view';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CodeEditor } from './CodeEditor';
import { CodeMirrorEditor } from './CodeEditorLazy';

const query = `{
  "expr": "up",
  "refId": "A"
}`;

describe('CodeMirrorEditor copy button', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  });

  afterEach(() => {
    Reflect.deleteProperty(window, 'isSecureContext');
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('shows the button over the editor only while showCopyButton is set, keeping the same editor', async () => {
    const { rerender } = render(<CodeEditor value={query} onChange={jest.fn()} readOnly aria-label="Query" />);
    const view = EditorView.findFromDOM(await screen.findByRole('textbox', { name: 'Query' }));
    expect(screen.queryByRole('button', { name: 'Copy to clipboard' })).not.toBeInTheDocument();

    rerender(<CodeEditor value={query} onChange={jest.fn()} readOnly aria-label="Query" showCopyButton />);
    const button = await screen.findByRole('button', { name: 'Copy to clipboard' });
    expect(view?.dom).toContainElement(button);
    expect(button.parentElement).toHaveStyle({ position: 'absolute' });

    rerender(<CodeEditor value={query} onChange={jest.fn()} readOnly aria-label="Query" />);
    expect(screen.queryByRole('button', { name: 'Copy to clipboard' })).not.toBeInTheDocument();
    expect(EditorView.findFromDOM(screen.getByRole('textbox', { name: 'Query' }))).toBe(view);
  });

  it('copies the whole document of a read-only editor while part of it is selected', async () => {
    const user = userEvent.setup();
    render(<CodeMirrorEditor value={query} onChange={jest.fn()} readOnly aria-label="Query" showCopyButton />);
    const view = EditorView.findFromDOM(await screen.findByRole('textbox', { name: 'Query' }));
    act(() => view?.dispatch({ selection: { anchor: 4, head: 10 } }));
    expect(view?.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe('"expr"');

    await user.click(await screen.findByRole('button', { name: 'Copy to clipboard' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Copied');
    expect(await navigator.clipboard.readText()).toBe(query);
  });

  it('copies the current document of an editable editor rather than the last value prop', async () => {
    const user = userEvent.setup();
    render(<CodeEditor value="SELECT 1" onChange={jest.fn()} aria-label="Query" showCopyButton />);
    const view = EditorView.findFromDOM(await screen.findByRole('textbox', { name: 'Query' }));
    act(() => view?.dispatch({ changes: { from: 8, insert: '0' } }));

    await user.click(await screen.findByRole('button', { name: 'Copy to clipboard' }));

    expect(await navigator.clipboard.readText()).toBe('SELECT 10');
  });

  it('shows an error for 2 seconds when the clipboard rejects the copy', async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    jest.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
    render(<CodeEditor value={query} onChange={jest.fn()} readOnly aria-label="Query" showCopyButton />);

    await user.click(await screen.findByRole('button', { name: 'Copy to clipboard' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not copy to clipboard');
    act(() => jest.advanceTimersByTime(1999));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not copy to clipboard');
    act(() => jest.advanceTimersByTime(1));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('is reached with Tab from a read-only editor and copies with Enter', async () => {
    const user = userEvent.setup();
    render(<CodeEditor value={query} onChange={jest.fn()} readOnly aria-label="Query" showCopyButton />);
    const button = await screen.findByRole('button', { name: 'Copy to clipboard' });

    await user.click(screen.getByRole('textbox', { name: 'Query' }));
    await user.tab();
    expect(button).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(await navigator.clipboard.readText()).toBe(query);
  });
});

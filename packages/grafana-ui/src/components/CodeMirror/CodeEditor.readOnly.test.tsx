import { EditorView } from '@codemirror/view';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CodeEditor } from './CodeEditor';

describe('CodeMirror CodeEditor read-only without onChange', () => {
  it('keeps the document in sync with value and rejects typing', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<CodeEditor value="SELECT 1" readOnly aria-label="Query" />);
    const editor = await screen.findByRole('textbox', { name: 'Query' });

    await user.click(editor);
    await user.keyboard('abc');
    expect(editor).toHaveTextContent(/^SELECT 1$/);

    rerender(<CodeEditor value="SELECT 2" readOnly aria-label="Query" />);
    expect(editor).toHaveTextContent(/^SELECT 2$/);
  });

  it('applies a programmatic change without logging an error', async () => {
    const consoleError = jest.spyOn(console, 'error');
    render(<CodeEditor value="SELECT 1" readOnly aria-label="Query" />);
    const view = EditorView.findFromDOM(await screen.findByRole('textbox', { name: 'Query' }));

    view?.dispatch({ changes: { from: 7, to: 8, insert: '2' } });

    expect(view?.state.doc.toString()).toBe('SELECT 2');
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

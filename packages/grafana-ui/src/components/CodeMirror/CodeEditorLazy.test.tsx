import { EditorView } from '@codemirror/view';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { VariableOrigin } from '@grafana/data';

import { CodeMirrorEditor } from './CodeEditorLazy';
import { type CodeMirrorEditorProps, type SignatureHelpProvider } from './types';

const signature =
  (name: string): SignatureHelpProvider =>
  () => ({
    signatures: [{ name, parameters: [{ label: 'value' }], documentation: `${name} documentation` }],
    activeSignature: 0,
    activeParameter: 0,
  });

describe('CodeMirrorEditor lazy wrapper', () => {
  it('shows a loading placeholder before rendering the editor', async () => {
    render(<CodeMirrorEditor value="SELECT 1" onChange={jest.fn()} />);

    expect(screen.getByText('Loading editor')).toBeInTheDocument();
    expect(await screen.findByRole('textbox')).toHaveTextContent('SELECT 1');
  });

  it('shows an error boundary fallback when the editor fails to start', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(
        <CodeMirrorEditor
          value=""
          onChange={jest.fn()}
          signatureHelp={() => {
            throw new Error('Provider failure');
          }}
        />
      );
      expect(await screen.findByText('CodeMirror editor failed to load')).toBeInTheDocument();
      expect(consoleErrorSpy).toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('ignores raw extensions, so one from another copy of CodeMirror cannot break the editor', async () => {
    // CodeMirror rejects an object it doesn't recognize, which is how an extension
    // built with a plugin's own copy of CodeMirror looks to Grafana's copy.
    const props = { value: 'SELECT 1', onChange: jest.fn(), extensions: [{}] } as unknown as CodeMirrorEditorProps;

    render(<CodeMirrorEditor {...props} />);

    expect(await screen.findByRole('textbox')).toHaveTextContent('SELECT 1');
    expect(screen.queryByText('CodeMirror editor failed to load')).not.toBeInTheDocument();
  });

  it('shows the placeholder while the editor is empty', async () => {
    render(<CodeMirrorEditor value="" onChange={jest.fn()} placeholder="Write a query" />);

    expect(await screen.findByText('Write a query')).toBeInTheDocument();
  });

  it('updates and removes signature help on the same mounted editor', async () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <CodeMirrorEditor value="round(1)" onChange={onChange} signatureHelp={signature('round')} />
    );
    const textbox = await screen.findByRole('textbox');
    const view = EditorView.findFromDOM(textbox);
    expect(await screen.findByText('round documentation')).toBeInTheDocument();

    rerender(<CodeMirrorEditor value="round(1)" onChange={onChange} signatureHelp={signature('ceil')} />);
    expect(await screen.findByText('ceil documentation')).toBeInTheDocument();
    expect(screen.queryByText('round documentation')).not.toBeInTheDocument();
    expect(EditorView.findFromDOM(screen.getByRole('textbox'))).toBe(view);

    rerender(<CodeMirrorEditor value="round(1)" onChange={onChange} />);
    await waitFor(() => expect(screen.queryByText('ceil documentation')).not.toBeInTheDocument());
    expect(screen.getByRole('textbox')).toHaveTextContent('round(1)');
    expect(EditorView.findFromDOM(screen.getByRole('textbox'))).toBe(view);
  });

  it('updates and removes variable suggestions on the same mounted editor', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const variables = (value: string) => [{ value, label: value, origin: VariableOrigin.Template }];
    const { rerender } = render(
      <CodeMirrorEditor value="$" onChange={onChange} variableSuggestions={variables('region')} />
    );
    const textbox = await screen.findByRole('textbox');
    const view = EditorView.findFromDOM(textbox);
    await user.click(textbox);
    await user.keyboard('{End}{Control>} {/Control}');
    expect(await screen.findByRole('option', { name: /region/ })).toBeInTheDocument();
    await user.keyboard('{Escape}');

    rerender(<CodeMirrorEditor value="$" onChange={onChange} variableSuggestions={variables('server')} />);
    await user.keyboard('{Control>} {/Control}');
    expect(await screen.findByRole('option', { name: /server/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /region/ })).not.toBeInTheDocument();
    expect(EditorView.findFromDOM(screen.getByRole('textbox'))).toBe(view);
    await user.keyboard('{Escape}');

    rerender(<CodeMirrorEditor value="$" onChange={onChange} />);
    await user.keyboard('{Control>} {/Control}');
    await waitFor(() => expect(view?.state.languageDataAt('autocomplete', 1)).toEqual([]));
    expect(screen.getByRole('textbox')).toHaveTextContent('$');
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    expect(EditorView.findFromDOM(screen.getByRole('textbox'))).toBe(view);
  });
});

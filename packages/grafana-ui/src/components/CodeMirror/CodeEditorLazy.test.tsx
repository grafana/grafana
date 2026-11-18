import { EditorView } from '@codemirror/view';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { VariableOrigin } from '@grafana/data';

import { CodeMirrorEditor, InternalCodeMirrorEditor } from './CodeEditorLazy';
import { type CodeMirrorCompletionContext, type CodeMirrorEditorProps, type SignatureHelpProvider } from './types';

const signature =
  (name: string): SignatureHelpProvider =>
  ({ sliceDoc }) =>
    sliceDoc() === 'round(1)'
      ? {
          signatures: [{ name, parameters: [{ label: 'value' }], documentation: `${name} documentation` }],
          activeSignature: 0,
          activeParameter: 0,
        }
      : null;

describe('CodeMirrorEditor', () => {
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

  it('applies a completion described through the public context and result', async () => {
    const user = userEvent.setup();
    const nativeApply = jest.fn();
    const source = jest.fn(({ matchBefore, sliceDoc, pos }: CodeMirrorCompletionContext) => {
      const word = matchBefore(/\w+$/);
      if (!word || sliceDoc(word.from, pos) !== 'ma') {
        return null;
      }

      return {
        from: word.from,
        options: [{ label: 'max', insertText: 'max(value)', apply: nativeApply }],
      };
    });
    render(<CodeMirrorEditor value="ma" onChange={jest.fn()} completionMode="override" completionSources={[source]} />);
    const textbox = await screen.findByRole('textbox');
    await user.click(textbox);
    await user.keyboard('{End}{Control>} {/Control}');

    const option = await screen.findByRole('option', { selected: true });
    expect(option).toHaveTextContent(/^max$/);
    const context = source.mock.calls[0][0];
    expect(context).not.toHaveProperty('state');
    expect(context).not.toHaveProperty('view');

    await user.click(option);
    expect(textbox).toHaveTextContent('max(value)');
    expect(nativeApply).not.toHaveBeenCalled();
  });

  it('signals cancellation to an abandoned async completion provider', async () => {
    const user = userEvent.setup();
    const source = jest.fn(
      ({ signal }: CodeMirrorCompletionContext) =>
        new Promise<null>((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        })
    );
    render(
      <CodeMirrorEditor value="abc" onChange={jest.fn()} completionMode="override" completionSources={[source]} />
    );
    const textbox = await screen.findByRole('textbox');
    await user.click(textbox);
    await user.keyboard('{End}{Control>} {/Control}');
    await waitFor(() => expect(source).toHaveBeenCalled());
    const { signal } = source.mock.calls[0][0];
    expect(signal.aborted).toBe(false);

    await user.keyboard('{Home}');
    await waitFor(() => expect(signal.aborted).toBe(true));
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

describe('InternalCodeMirrorEditor', () => {
  it('applies raw extensions and theme extensions', async () => {
    render(
      <InternalCodeMirrorEditor
        value="SELECT 1"
        onChange={jest.fn()}
        aria-label="Query"
        extensions={[EditorView.contentAttributes.of({ 'data-cell': 'query' })]}
        theme={EditorView.theme({ '&': { backgroundColor: 'rgb(1, 2, 3)' } })}
      />
    );

    const textbox = await screen.findByRole('textbox', { name: 'Query' });
    expect(textbox).toHaveAttribute('data-cell', 'query');
    expect(getComputedStyle(EditorView.findFromDOM(textbox)!.dom).backgroundColor).toBe('rgb(1, 2, 3)');
  });
});

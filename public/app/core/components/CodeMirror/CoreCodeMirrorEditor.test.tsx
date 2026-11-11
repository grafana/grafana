import { type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { render, screen } from '@testing-library/react';

import { CoreCodeMirrorEditor } from './CoreCodeMirrorEditor';

describe('CoreCodeMirrorEditor', () => {
  it('applies raw extensions on top of the editor defaults', async () => {
    render(
      <CoreCodeMirrorEditor
        value="SELECT 1"
        onChange={jest.fn()}
        aria-label="Query"
        extensions={[EditorView.contentAttributes.of({ 'data-cell': 'query' })]}
      />
    );

    const textbox = await screen.findByRole('textbox', { name: 'Query' });
    expect(textbox).toHaveAttribute('data-cell', 'query');
    expect(textbox).toHaveTextContent('SELECT 1');
  });

  it('replaces the Grafana theme with a theme extension', async () => {
    render(
      <CoreCodeMirrorEditor
        value=""
        onChange={jest.fn()}
        theme={EditorView.theme({ '&': { backgroundColor: 'rgb(1, 2, 3)' } })}
      />
    );

    const view = EditorView.findFromDOM(await screen.findByRole('textbox'));
    expect(getComputedStyle(view!.dom).backgroundColor).toBe('rgb(1, 2, 3)');
  });

  it('shows an error instead of the editor when CodeMirror rejects an extension', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(<CoreCodeMirrorEditor value="" onChange={jest.fn()} extensions={[{} as Extension]} />);

      expect(await screen.findByText('Code editor failed to load')).toBeInTheDocument();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});

import { language } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactElement, StrictMode, useLayoutEffect, useState } from 'react';

import { createTheme, ThemeContext } from '@grafana/data';

import { DiffEditor } from './DiffEditor';

function DiffWithParentInput({ lineSeparator }: { lineSeparator: string }): ReactElement {
  const [value, setValue] = useState('');

  return (
    <>
      <input aria-label="Parent input" value={value} onChange={(event) => setValue(event.currentTarget.value)} />
      <DiffEditor original={`before content${lineSeparator}shared`} modified={`after content${lineSeparator}shared`} />
    </>
  );
}

function DiffWithMountConfigurationChange(): ReactElement {
  const [lineNumbers, setLineNumbers] = useState(true);
  useLayoutEffect(() => setLineNumbers(false), []);

  return <DiffEditor original="before" modified="after" lineNumbers={lineNumbers} />;
}

describe('CodeMirror DiffEditor', () => {
  it('applies configuration changes made before the merge view is ready', async () => {
    const { container } = render(<DiffWithMountConfigurationChange />);

    expect(await screen.findByRole('textbox', { name: 'Modified' })).toHaveTextContent('after');
    expect(container.querySelector('.cm-lineNumbers')).not.toBeInTheDocument();
  });

  it.each(['\n', '\r\n'])(
    'preserves external focus, selection and scroll when its parent rerenders (%j)',
    async (lineSeparator) => {
      const user = userEvent.setup();
      const { container } = render(<DiffWithParentInput lineSeparator={lineSeparator} />);
      const view = EditorView.findFromDOM(screen.getByRole('textbox', { name: 'Modified' }));
      const scroller = container.querySelector<HTMLElement>('.cm-mergeView');
      if (!view || !scroller) {
        throw new Error('Side-by-side diff did not mount');
      }

      // jsdom cannot position a selection in a non-editable CodeMirror view.
      act(() => view.dispatch({ selection: { anchor: 5, head: 15 } }));
      scroller.scrollTop = 600;
      const input = screen.getByRole('textbox', { name: 'Parent input' });

      await user.type(input, 'xy');

      expect(input).toHaveValue('xy');
      expect(input).toHaveFocus();
      expect(
        EditorView.findFromDOM(screen.getByRole('textbox', { name: 'Modified' }))?.state.selection.main
      ).toMatchObject({
        anchor: 5,
        head: 15,
      });
      expect(container.querySelector<HTMLElement>('.cm-mergeView')?.scrollTop).toBe(600);
    }
  );

  it.each([false, true])('shows changes without allowing edits (inline: %s)', async (inline) => {
    const user = userEvent.setup();
    const { container } = render(<DiffEditor original={'before\nshared'} modified={'after\nshared'} inline={inline} />);
    const modified = screen.getByRole('textbox', { name: 'Modified' });

    expect(modified).toHaveTextContent('after');
    expect(container.querySelector('.cm-deletedChunk, .cm-merge-a .cm-changedLine')).toHaveTextContent('before');
    expect(container.querySelector('.cm-merge-b .cm-changedLine')).toHaveTextContent('after');
    for (const editor of screen.getAllByRole('textbox')) {
      expect(EditorView.findFromDOM(editor)?.state.readOnly).toBe(true);
      expect(editor).toHaveAttribute('contenteditable', 'false');
    }
    await user.click(modified);
    await user.keyboard('x{Backspace}');

    expect(EditorView.findFromDOM(modified)?.state.doc.toString()).toBe('after\nshared');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it.each([false, true])('updates supplied values, language and line numbers (inline: %s)', async (inline) => {
    const { container, rerender } = render(
      <DiffEditor original='{"value":1}' modified='{"value":2}' language="json" inline={inline} height="240px" />
    );
    const modifiedView = (): EditorView | null =>
      EditorView.findFromDOM(screen.getByRole('textbox', { name: 'Modified' }));
    await waitFor(() => expect(modifiedView()?.state.facet(language)?.name).toBe('json'));
    expect(container.querySelector('.cm-lineNumbers')).toHaveTextContent('1');
    expect(container.firstChild).toHaveStyle({ height: '240px' });

    rerender(
      <DiffEditor
        original="value: before"
        modified="value: after"
        language="yaml"
        inline={inline}
        lineNumbers={false}
        height="320px"
      />
    );

    await waitFor(() => expect(modifiedView()?.state.facet(language)?.name).toBe('yaml'));
    expect(modifiedView()?.state.doc.toString()).toBe('value: after');
    expect(container.querySelector('.cm-deletedChunk, .cm-merge-a .cm-changedLine')).toHaveTextContent('value: before');
    expect(container.querySelector('.cm-lineNumbers')).not.toBeInTheDocument();
    expect(container.firstChild).toHaveStyle({ height: '320px' });
  });

  it.each([false, true])(
    'updates and clears supplied values without changing language (inline: %s)',
    async (inline) => {
      const { container, rerender } = render(<DiffEditor original="before" modified="after" inline={inline} />);

      rerender(<DiffEditor original="previous" modified="current" inline={inline} />);

      expect(EditorView.findFromDOM(screen.getByRole('textbox', { name: 'Modified' }))?.state.doc.toString()).toBe(
        'current'
      );
      expect(container.querySelector('.cm-deletedChunk, .cm-merge-a .cm-changedLine')).toHaveTextContent('previous');

      // jsdom cannot position a selection in a non-editable CodeMirror view.
      act(() => {
        for (const editor of screen.getAllByRole('textbox')) {
          const view = EditorView.findFromDOM(editor);
          if (view) {
            view.dispatch({ selection: { anchor: view.state.doc.length } });
          }
        }
      });

      rerender(<DiffEditor original="" modified="" inline={inline} />);

      for (const editor of screen.getAllByRole('textbox')) {
        expect(EditorView.findFromDOM(editor)?.state.doc.toString()).toBe('');
      }
      expect(container.querySelector('.cm-deletedChunk')).not.toBeInTheDocument();
    }
  );

  it('keeps deleted inline text highlighted after language loading and theme changes', async () => {
    const lightTheme = createTheme({ colors: { mode: 'light' } });
    const darkTheme = createTheme({ colors: { mode: 'dark' } });
    const { container, rerender } = render(
      <ThemeContext.Provider value={lightTheme}>
        <DiffEditor original='{"value":"before"}' modified='{"value":"after"}' language="json" inline />
      </ThemeContext.Provider>
    );

    await waitFor(() =>
      expect(container.querySelector('.cm-deletedChunk .cm-deletedText')).toHaveStyle({
        color: lightTheme.components.codeEditor.string,
      })
    );

    rerender(
      <ThemeContext.Provider value={darkTheme}>
        <DiffEditor original='{"value":"before"}' modified='{"value":"after"}' language="json" inline />
      </ThemeContext.Provider>
    );

    expect(container.querySelector('.cm-deletedChunk .cm-deletedText')).toHaveStyle({
      color: darkTheme.components.codeEditor.string,
    });
  });

  it('cleans up both modes when switching and remounting effects in StrictMode', () => {
    const { container, rerender, unmount } = render(
      <StrictMode>
        <DiffEditor original="before" modified="after" />
      </StrictMode>
    );
    expect(screen.getAllByRole('textbox')).toHaveLength(2);

    rerender(
      <StrictMode>
        <DiffEditor original="before" modified="after" inline />
      </StrictMode>
    );
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(container.querySelector('.cm-deletedChunk')).toHaveTextContent('before');

    unmount();
    expect(container).toBeEmptyDOMElement();
  });
});

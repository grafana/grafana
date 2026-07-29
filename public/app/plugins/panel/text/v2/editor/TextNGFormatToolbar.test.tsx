import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useRef } from 'react';

import { TextMode } from '../../panelcfg.gen';

import { TextNGFormatToolbar } from './TextNGFormatToolbar';

let view: EditorView | undefined;

/** Mounts a real EditorView so the toolbar can find it from the DOM. */
function Harness({
  mode,
  doc,
  selection,
}: {
  mode: TextMode;
  doc: string;
  selection?: { anchor: number; head?: number };
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    view = new EditorView({ parent: containerRef.current!, state: EditorState.create({ doc, selection }) });
    return () => view?.destroy();
    // The doc is fixed per test; re-creating the view would discard the edits
    // under assertion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <TextNGFormatToolbar mode={mode} editorContainerRef={containerRef} />
      <div ref={containerRef} />
    </>
  );
}

const setup = (mode: TextMode, doc = '', selection?: { anchor: number; head?: number }) =>
  render(<Harness mode={mode} doc={doc} selection={selection} />);

const clickButton = (name: string) => userEvent.click(screen.getByRole('button', { name }));

afterEach(() => {
  view = undefined;
});

describe('TextNGFormatToolbar', () => {
  describe('available actions', () => {
    it('offers the markdown actions in markdown mode', () => {
      setup(TextMode.Markdown);

      for (const name of ['Heading', 'Bold', 'Italic', 'Link', 'Bullet list', 'Numbered list', 'Checklist', 'Table']) {
        expect(screen.getByRole('button', { name })).toBeInTheDocument();
      }
      expect(screen.getByRole('button', { name: 'Insert variable' })).toBeInTheDocument();
    });

    it('offers only the tag-based actions in HTML mode', () => {
      setup(TextMode.HTML);

      expect(screen.getByRole('button', { name: 'Bold' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Italic' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Link' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Insert variable' })).toBeInTheDocument();
      // Markdown-only syntax has no HTML equivalent worth a one-click insert.
      expect(screen.queryByRole('button', { name: 'Heading' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Table' })).not.toBeInTheDocument();
    });

    it('renders nothing in code mode', () => {
      setup(TextMode.Code);

      expect(screen.queryByRole('button', { name: 'Bold' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Insert variable' })).not.toBeInTheDocument();
    });
  });

  describe('markdown actions', () => {
    it('wraps the selection in bold markers', async () => {
      setup(TextMode.Markdown, 'hello world', { anchor: 0, head: 5 });

      await clickButton('Bold');

      expect(view!.state.doc.toString()).toBe('**hello** world');
    });

    it('wraps the selection in italic markers', async () => {
      setup(TextMode.Markdown, 'hello', { anchor: 0, head: 5 });

      await clickButton('Italic');

      expect(view!.state.doc.toString()).toBe('*hello*');
    });

    it('turns the selection into a link', async () => {
      setup(TextMode.Markdown, 'Grafana', { anchor: 0, head: 7 });

      await clickButton('Link');

      expect(view!.state.doc.toString()).toBe('[Grafana](https://)');
    });

    it('prefixes the selected lines for headings and lists', async () => {
      setup(TextMode.Markdown, 'one\ntwo', { anchor: 0, head: 7 });

      await clickButton('Bullet list');

      expect(view!.state.doc.toString()).toBe('- one\n- two');
    });

    it('inserts a table skeleton', async () => {
      setup(TextMode.Markdown, '');

      await clickButton('Table');

      expect(view!.state.doc.toString()).toContain('| Column | Column |');
    });

    it('inserts a variable placeholder', async () => {
      setup(TextMode.Markdown, '');

      await clickButton('Insert variable');

      expect(view!.state.doc.toString()).toBe('${}');
    });
  });

  describe('HTML actions', () => {
    it('wraps the selection in tags', async () => {
      setup(TextMode.HTML, 'hello', { anchor: 0, head: 5 });

      await clickButton('Bold');

      expect(view!.state.doc.toString()).toBe('<b>hello</b>');
    });

    it('turns the selection into an anchor', async () => {
      setup(TextMode.HTML, 'Grafana', { anchor: 0, head: 7 });

      await clickButton('Link');

      expect(view!.state.doc.toString()).toBe('<a href="https://">Grafana</a>');
    });
  });

  it('does nothing while the lazily-loaded editor has not mounted yet', async () => {
    const emptyRef = { current: document.createElement('div') };
    render(<TextNGFormatToolbar mode={TextMode.Markdown} editorContainerRef={emptyRef} />);

    await clickButton('Bold');

    expect(screen.getByRole('button', { name: 'Bold' })).toBeInTheDocument();
  });

  it('returns focus to the editor so typing continues where it left off', async () => {
    setup(TextMode.Markdown, 'hello', { anchor: 0, head: 5 });

    await clickButton('Bold');

    expect(view!.hasFocus).toBe(true);
  });
});

import { render, screen, waitFor } from 'test/test-utils';

import { type CellContentKind } from 'app/features/notebook/types';

import { MarkdownCell } from './MarkdownCell';

// The real CodeMirrorEditor is a heavy, lazily loaded bundle that does not run in jsdom. A textarea
// carries readOnly into the DOM, so the assertions are on rendered output rather than on props
// handed to a stub. See CodeCell.test.tsx for the identical rationale — the stub stands in for how
// CodeMirror answers the cell's request for the caret: a new `extensions` identity is what rebuilds
// the view plugins, so it focuses on exactly that signal, on the next frame, as the real plugin does.
//
// Unlike CodeCell, MarkdownCell always includes the live-preview extension alongside an optional focus
// request, so `extensions` is never empty — the signal here is a *second* entry (the live-preview
// extension takes exactly one array slot; the focus request, when present, adds one more), not mere
// non-emptiness.
jest.mock('@grafana/ui/unstable', () => {
  // Required inside the factory, which jest hoists above the imports.
  const { useEffect, useRef } = require('react');

  return {
    ...jest.requireActual('@grafana/ui/unstable'),
    CodeMirrorEditor: ({
      value,
      extensions,
      onChange,
      'aria-label': ariaLabel,
    }: {
      value: string;
      extensions?: unknown[];
      onChange: (value: string) => void;
      'aria-label'?: string;
    }) => {
      const ref = useRef(null);

      useEffect(() => {
        if (!extensions || extensions.length < 2) {
          return;
        }

        const frame = requestAnimationFrame(() => ref.current?.focus());
        return () => cancelAnimationFrame(frame);
      }, [extensions]);

      return <textarea ref={ref} aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} />;
    },
  };
});

const content: CellContentKind = { kind: 'Markdown', spec: { text: '**bold**' } };

// The cell asks for the caret a frame late, so an assertion that it stayed put has to outlast that.
const waitForFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

describe('MarkdownCell', () => {
  it('renders nothing for a non-Markdown content kind', () => {
    const other: CellContentKind = { kind: 'Code', spec: { code: 'select 1', language: 'sql' } };
    const { container } = render(<MarkdownCell content={other} isEditing={false} onChange={jest.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders sanitized markdown while the notebook is being read', async () => {
    render(<MarkdownCell content={content} isEditing={false} onChange={jest.fn()} />);

    expect(await screen.findByText('bold')).toBeInTheDocument();
    expect(screen.queryByLabelText('Markdown')).not.toBeInTheDocument();
  });

  it('offers an editor once the notebook is being edited, instead of the static render', () => {
    render(<MarkdownCell content={content} isEditing={true} onChange={jest.fn()} />);

    expect(screen.getByLabelText('Markdown')).toBeInTheDocument();
    expect(screen.queryByText('bold')).not.toBeInTheDocument();
  });

  it('reports edits back as markdown content', async () => {
    const onChange = jest.fn();
    const { user } = render(<MarkdownCell content={content} isEditing={true} onChange={onChange} />);

    await user.type(screen.getByLabelText('Markdown'), '!');

    expect(onChange).toHaveBeenLastCalledWith({ kind: 'Markdown', spec: { text: '**bold**!' } });
  });

  it('preserves schema fields the cell does not render', async () => {
    const annotated = { kind: 'Markdown', spec: { text: '**bold**', extra: 'kept' } } as unknown as CellContentKind;
    const onChange = jest.fn();
    const { user } = render(<MarkdownCell content={annotated} isEditing={true} onChange={onChange} />);

    await user.type(screen.getByLabelText('Markdown'), '!');

    expect(onChange).toHaveBeenLastCalledWith({ kind: 'Markdown', spec: { text: '**bold**!', extra: 'kept' } });
  });

  describe('the caret', () => {
    it('is left alone unless the cell was just inserted', async () => {
      render(<MarkdownCell content={content} isEditing={true} onChange={jest.fn()} />);

      await waitForFrame();
      expect(screen.getByLabelText('Markdown')).not.toHaveFocus();
    });

    it('goes to the editor when the cell was just inserted', async () => {
      render(<MarkdownCell content={content} isEditing={true} autoFocus onChange={jest.fn()} />);

      await waitFor(() => expect(screen.getByLabelText('Markdown')).toHaveFocus());
    });

    // A read-only cell taking the caret would scroll the reader down the document to a cell they
    // cannot type into.
    it('is left alone while the notebook is being read', async () => {
      render(<MarkdownCell content={content} isEditing={false} autoFocus onChange={jest.fn()} />);

      await waitForFrame();
      expect(screen.queryByLabelText('Markdown')).not.toBeInTheDocument();
    });

    // The request belongs to the moment the cell was inserted, not to edit mode. Re-reading the mode
    // would replay it, so a reader who leaves edit mode and comes back would be thrown down the
    // document to whichever cell they last added.
    it('is not asked for again when edit mode comes back', async () => {
      const { rerender } = render(<MarkdownCell content={content} isEditing={true} autoFocus onChange={jest.fn()} />);
      await waitFor(() => expect(screen.getByLabelText('Markdown')).toHaveFocus());

      rerender(<MarkdownCell content={content} isEditing={false} autoFocus onChange={jest.fn()} />);
      rerender(<MarkdownCell content={content} isEditing={true} autoFocus onChange={jest.fn()} />);

      await waitForFrame();
      expect(screen.getByLabelText('Markdown')).not.toHaveFocus();
    });
  });
});

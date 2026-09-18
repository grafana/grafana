import { render, screen, waitFor } from 'test/test-utils';

import { type CellContentKind } from 'app/features/notebook/types';

import { MarkdownCell } from './MarkdownCell';

jest.mock('@grafana/ui/unstable', () => {
  const { useEffect, useRef } = require('react');

  return {
    ...jest.requireActual('@grafana/ui/unstable'),
    CodeMirrorEditor: ({
      value,
      basicSetup,
      extensions,
      onChange,
      'aria-label': ariaLabel,
    }: {
      value: string;
      basicSetup?: { history?: boolean };
      extensions?: unknown[];
      onChange: (value: string) => void;
      'aria-label'?: string;
    }) => {
      const ref = useRef(null);

      useEffect(() => {
        // Baseline is 3 now (livePreview + the permanent scrollMarginExtension + the Enter/Shift-Enter
        // keymap) — a real focus grant adds exactly one more on top of that.
        if (!extensions || extensions.length < 4) {
          return;
        }

        const frame = requestAnimationFrame(() => ref.current?.focus());
        return () => cancelAnimationFrame(frame);
      }, [extensions]);

      return (
        <textarea
          ref={ref}
          aria-label={ariaLabel}
          value={value}
          data-native-history={basicSetup?.history === false ? 'disabled' : 'enabled'}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    },
  };
});

const content: CellContentKind = { kind: 'Markdown', spec: { text: '**bold**' } };

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

  it('offers an editor once the notebook is being edited, instead of the static render', async () => {
    render(<MarkdownCell content={content} isEditing={true} onChange={jest.fn()} />);

    expect(await screen.findByLabelText('Markdown')).toBeInTheDocument();
    expect(screen.queryByText('bold')).not.toBeInTheDocument();
  });

  describe('the caret', () => {
    it('is left alone unless the cell was just inserted', async () => {
      render(<MarkdownCell content={content} isEditing={true} onChange={jest.fn()} />);

      const editor = await screen.findByLabelText('Markdown');
      await waitForFrame();
      expect(editor).not.toHaveFocus();
    });

    it('goes to the editor when the cell was just inserted', async () => {
      render(<MarkdownCell content={content} isEditing={true} autoFocus onChange={jest.fn()} />);

      await waitFor(() => expect(screen.getByLabelText('Markdown')).toHaveFocus());
    });

    it('is left alone while the notebook is being read', async () => {
      render(<MarkdownCell content={content} isEditing={false} autoFocus onChange={jest.fn()} />);

      await waitForFrame();
      expect(screen.queryByLabelText('Markdown')).not.toBeInTheDocument();
    });

    it('is not asked for again when edit mode comes back', async () => {
      const { rerender } = render(<MarkdownCell content={content} isEditing={true} autoFocus onChange={jest.fn()} />);
      await waitFor(() => expect(screen.getByLabelText('Markdown')).toHaveFocus());

      rerender(<MarkdownCell content={content} isEditing={false} autoFocus onChange={jest.fn()} />);
      rerender(<MarkdownCell content={content} isEditing={true} autoFocus onChange={jest.fn()} />);

      const editor = await screen.findByLabelText('Markdown');
      await waitForFrame();
      expect(editor).not.toHaveFocus();
    });

    it('is focused again when a fresh request names it, even though it was already the target', async () => {
      const { rerender } = render(
        <MarkdownCell content={content} isEditing={true} autoFocus focusRequestId={1} onChange={jest.fn()} />
      );
      await waitFor(() => expect(screen.getByLabelText('Markdown')).toHaveFocus());

      screen.getByLabelText('Markdown').blur();
      rerender(<MarkdownCell content={content} isEditing={true} autoFocus focusRequestId={2} onChange={jest.fn()} />);

      await waitFor(() => expect(screen.getByLabelText('Markdown')).toHaveFocus());
    });
  });
});

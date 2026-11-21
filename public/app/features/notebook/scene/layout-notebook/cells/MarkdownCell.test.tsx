import { fireEvent, render, screen, waitFor } from 'test/test-utils';

import { locationService } from '@grafana/runtime';
import { type CellContentKind } from 'app/features/notebook/types';

import { MarkdownCell, resetInitialHashRestorationForTests } from './MarkdownCell';

jest.mock('@grafana/ui/internal', () => {
  const { useEffect, useRef } = require('react');

  return {
    ...jest.requireActual('@grafana/ui/internal'),
    InternalCodeMirrorEditor: ({
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

  it.each([
    { name: 'a paragraph', prefix: '' },
    { name: 'a list item', prefix: '- ' },
  ])('allows long inline code in $name to wrap, including unbroken identifiers', async ({ prefix }) => {
    const identifier = 'notebook_record_fingerprint_'.repeat(12);
    const markdown: CellContentKind = { kind: 'Markdown', spec: { text: `${prefix}\`${identifier}\`` } };
    render(<MarkdownCell content={markdown} isEditing={false} onChange={jest.fn()} />);

    expect(await screen.findByText(identifier, { selector: 'code' })).toHaveStyle({
      whiteSpace: 'normal',
      overflowWrap: 'anywhere',
    });
  });

  it('keeps fenced code whitespace intact and its container scrollable', async () => {
    const markdown: CellContentKind = {
      kind: 'Markdown',
      spec: { text: '```\nfirst   column\n    indented line\n```' },
    };
    render(<MarkdownCell content={markdown} isEditing={false} onChange={jest.fn()} />);

    const code = await screen.findByText(/first.*column/, { selector: 'pre code' });
    expect(code.textContent).toBe('first   column\n    indented line\n');
    expect(code.parentElement).toHaveStyle({ overflow: 'auto' });
    expect(code).not.toHaveStyle({ whiteSpace: 'normal' });
  });

  it('offers an editor once the notebook is being edited, instead of the static render', async () => {
    render(<MarkdownCell content={content} isEditing={true} onChange={jest.fn()} />);

    expect(await screen.findByLabelText('Markdown')).toBeInTheDocument();
    expect(screen.queryByText('bold')).not.toBeInTheDocument();
  });

  describe('contents links', () => {
    const withContents: CellContentKind = {
      kind: 'Markdown',
      spec: { text: '## Table of Contents\n\n- [Herbs](#herbs)\n\n## Herbs\n\nBasil.' },
    };

    afterEach(() => {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      resetInitialHashRestorationForTests();
    });

    it('gives headings ids so a contents link has somewhere to go', async () => {
      render(<MarkdownCell content={withContents} isEditing={false} onChange={jest.fn()} />);

      expect(await screen.findByRole('heading', { name: 'Herbs' })).toHaveAttribute('id', 'herbs');
    });

    it('scrolls smoothly to the heading a contents link names', async () => {
      const scrollIntoView = jest.spyOn(HTMLElement.prototype, 'scrollIntoView');
      render(<MarkdownCell content={withContents} isEditing={false} onChange={jest.fn()} />);

      fireEvent.click(await screen.findByRole('link', { name: 'Herbs' }));

      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
      expect(locationService.getLocation().hash).toBe('#herbs');
      scrollIntoView.mockRestore();
    });

    it('opens a copied url at the section its fragment names', async () => {
      window.location.hash = '#herbs';
      const scrollIntoView = jest.spyOn(HTMLElement.prototype, 'scrollIntoView');
      render(<MarkdownCell content={withContents} isEditing={false} onChange={jest.fn()} />);

      await screen.findByRole('heading', { name: 'Herbs' });
      await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' }));
      scrollIntoView.mockRestore();
    });

    it('does not re-restore hash scroll when editing ends or another cell mounts later', async () => {
      window.location.hash = '#herbs';
      const scrollIntoView = jest.spyOn(HTMLElement.prototype, 'scrollIntoView');
      const { rerender } = render(<MarkdownCell content={withContents} isEditing={false} onChange={jest.fn()} />);

      await screen.findByRole('heading', { name: 'Herbs' });
      await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));

      // Enter and exit edit mode
      rerender(<MarkdownCell content={withContents} isEditing={true} onChange={jest.fn()} />);
      rerender(<MarkdownCell content={withContents} isEditing={false} onChange={jest.fn()} />);

      // Mount another cell while the hash is still present in the URL
      const otherCell: CellContentKind = {
        kind: 'Markdown',
        spec: { text: '## Other Heading\n\nContent.' },
      };
      render(<MarkdownCell content={otherCell} isEditing={false} onChange={jest.fn()} />);
      await screen.findByRole('heading', { name: 'Other Heading' });

      // Should not have jumped to #herbs again
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      scrollIntoView.mockRestore();
    });

    it('leaves a link whose heading is not on the page to the browser', async () => {
      const markdown: CellContentKind = { kind: 'Markdown', spec: { text: '[Missing](#missing)' } };
      const scrollIntoView = jest.spyOn(HTMLElement.prototype, 'scrollIntoView');
      render(<MarkdownCell content={markdown} isEditing={false} onChange={jest.fn()} />);

      const click = fireEvent.click(await screen.findByRole('link', { name: 'Missing' }));

      expect(click).toBe(true);
      expect(scrollIntoView).not.toHaveBeenCalled();
      scrollIntoView.mockRestore();
    });

    it('does not throw on a fragment that is not valid percent-encoding', async () => {
      const markdown: CellContentKind = { kind: 'Markdown', spec: { text: '[Broken](#%)' } };
      const scrollIntoView = jest.spyOn(HTMLElement.prototype, 'scrollIntoView');
      render(<MarkdownCell content={markdown} isEditing={false} onChange={jest.fn()} />);

      expect(() => fireEvent.click(screen.getByRole('link', { name: 'Broken' }))).not.toThrow();
      expect(scrollIntoView).not.toHaveBeenCalled();
      scrollIntoView.mockRestore();
    });
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

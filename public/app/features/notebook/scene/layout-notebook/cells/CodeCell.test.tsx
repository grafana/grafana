import { act, render, screen, waitFor } from 'test/test-utils';

import { mockComboboxRect } from '@grafana/test-utils';
import { type CellContentKind } from 'app/features/notebook/types';

import { CodeCell } from './CodeCell';

// The real CodeMirrorEditor is a heavy, lazily loaded bundle that does not run in jsdom. A textarea
// carries readOnly into the DOM, so the assertions are on rendered output rather than on props
// handed to a stub. Only the editor is replaced: the rest of the module is reachable from this
// test's import tree (attachSkeleton, via the dashboard scene), and a wholesale mock takes it down.
//
// It also stands in for how CodeMirror answers the cell's request for the caret: a new `extensions`
// identity is what rebuilds the view plugins, so the stub focuses on exactly that signal, and on the
// next frame, as the real plugin does. What that pins is the cell asking at the right moments — the
// plugin doing the focusing needs a live CodeMirror and cannot run here.
jest.mock('@grafana/ui/unstable', () => {
  // Required inside the factory, which jest hoists above the imports.
  const { useEffect, useRef } = require('react');

  return {
    ...jest.requireActual('@grafana/ui/unstable'),
    CodeMirrorEditor: ({
      value,
      readOnly,
      basicSetup,
      extensions,
      onChange,
      'aria-label': ariaLabel,
    }: {
      value: string;
      readOnly?: boolean;
      basicSetup?: { history?: boolean };
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

      return (
        <textarea
          ref={ref}
          aria-label={ariaLabel}
          value={value}
          readOnly={readOnly}
          data-native-history={basicSetup?.history === false ? 'disabled' : 'enabled'}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    },
  };
});

// Combobox virtualizes its list, which needs measurable elements in jsdom.
mockComboboxRect();

const content: CellContentKind = { kind: 'Code', spec: { code: 'select 1', language: 'sql' } };

// The cell asks for the caret a frame late, so an assertion that it stayed put has to outlast that.
// Inside act: the language picker measures itself with a ResizeObserver, which lands in this window.
const waitForFrame = () => act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

describe('CodeCell', () => {
  it('is read only while the notebook is being read', () => {
    render(<CodeCell content={content} isEditing={false} onChange={jest.fn()} />);

    expect(screen.getByLabelText('Code')).toHaveAttribute('readonly');
  });

  it('takes input once the notebook is being edited', () => {
    render(<CodeCell content={content} isEditing={true} onChange={jest.fn()} />);

    expect(screen.getByLabelText('Code')).not.toHaveAttribute('readonly');
  });

  it('uses notebook history instead of a separate CodeMirror history', () => {
    render(<CodeCell content={content} isEditing={true} onChange={jest.fn()} />);

    expect(screen.getByLabelText('Code')).toHaveAttribute('data-native-history', 'disabled');
  });

  it('labels the cell with its language while reading, without offering the picker', () => {
    render(<CodeCell content={content} isEditing={false} onChange={jest.fn()} />);

    expect(screen.getByText('SQL')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  // Read mode and the picker used to disagree about the same '' value — one said `code`, the other
  // `Plain text`. Both go through codeLanguageLabel now.
  it('names the absent language the same way the picker does', () => {
    const plain: CellContentKind = { kind: 'Code', spec: { code: 'hello', language: '' } };
    const { rerender } = render(<CodeCell content={plain} isEditing={false} onChange={jest.fn()} />);

    expect(screen.getByText('Plain text')).toBeInTheDocument();

    rerender(<CodeCell content={plain} isEditing={true} onChange={jest.fn()} />);
    expect(screen.getByRole('combobox', { name: 'Code language' })).toHaveDisplayValue('Plain text');
  });

  it('offers the language picker once the notebook is being edited', () => {
    render(<CodeCell content={content} isEditing={true} onChange={jest.fn()} />);

    expect(screen.getByRole('combobox', { name: 'Code language' })).toHaveDisplayValue('SQL');
  });

  it('keeps the code when the language changes', async () => {
    const onChange = jest.fn();
    const { user } = render(<CodeCell content={content} isEditing={true} onChange={onChange} />);

    await user.click(screen.getByRole('combobox', { name: 'Code language' }));
    await user.click(screen.getByRole('option', { name: 'JSON' }));

    expect(onChange).toHaveBeenCalledWith({ kind: 'Code', spec: { code: 'select 1', language: 'json' } });
  });

  it('keeps the language when the code changes', async () => {
    const onChange = jest.fn();
    const { user } = render(<CodeCell content={content} isEditing={true} onChange={onChange} />);

    await user.type(screen.getByLabelText('Code'), '0');

    // The stub is uncontrolled from the test's point of view — the parent never feeds `value` back —
    // so a single keystroke appends to the original code.
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'Code', spec: { code: 'select 10', language: 'sql' } });
  });

  it('preserves schema fields the cell does not render', async () => {
    const annotated: CellContentKind = {
      kind: 'Code',
      spec: { code: 'select 1', language: 'sql', highlight: [1], annotation: 'why' },
    };
    const onChange = jest.fn();
    const { user } = render(<CodeCell content={annotated} isEditing={true} onChange={onChange} />);

    await user.type(screen.getByLabelText('Code'), '0');

    expect(onChange).toHaveBeenLastCalledWith({
      kind: 'Code',
      spec: { code: 'select 10', language: 'sql', highlight: [1], annotation: 'why' },
    });
  });

  describe('the caret', () => {
    it('is left alone unless the cell was just inserted', async () => {
      render(<CodeCell content={content} isEditing={true} onChange={jest.fn()} />);

      await waitForFrame();
      expect(screen.getByLabelText('Code')).not.toHaveFocus();
    });

    it('goes to the editor when the cell was just inserted', async () => {
      render(<CodeCell content={content} isEditing={true} autoFocus onChange={jest.fn()} />);

      await waitFor(() => expect(screen.getByLabelText('Code')).toHaveFocus());
    });

    // A read-only editor taking the caret would scroll the reader down the document to a cell they
    // cannot type into.
    it('is left alone while the notebook is being read', async () => {
      render(<CodeCell content={content} isEditing={false} autoFocus onChange={jest.fn()} />);

      await waitForFrame();
      expect(screen.getByLabelText('Code')).not.toHaveFocus();
    });

    // The request belongs to the moment the cell was inserted, not to edit mode. Re-reading the mode
    // would replay it, so a reader who leaves edit mode and comes back would be thrown down the
    // document to whichever cell they last added.
    it('is not asked for again when edit mode comes back', async () => {
      const { rerender } = render(<CodeCell content={content} isEditing={true} autoFocus onChange={jest.fn()} />);
      await waitFor(() => expect(screen.getByLabelText('Code')).toHaveFocus());

      rerender(<CodeCell content={content} isEditing={false} autoFocus onChange={jest.fn()} />);
      screen.getByLabelText('Code').blur();
      rerender(<CodeCell content={content} isEditing={true} autoFocus onChange={jest.fn()} />);

      await waitForFrame();
      expect(screen.getByLabelText('Code')).not.toHaveFocus();
    });

    // Choosing a language is something you do in order to write code, so the picker hands the caret
    // on rather than keeping it.
    it('returns to the editor after the language is chosen', async () => {
      const { user } = render(<CodeCell content={content} isEditing={true} onChange={jest.fn()} />);

      await user.click(screen.getByRole('combobox', { name: 'Code language' }));
      await user.click(screen.getByRole('option', { name: 'JSON' }));

      await waitFor(() => expect(screen.getByLabelText('Code')).toHaveFocus());
    });
  });

  it('shows a language it cannot highlight by name rather than as a stored string', () => {
    const promql: CellContentKind = { kind: 'Code', spec: { code: 'up', language: 'promql' } };
    render(<CodeCell content={promql} isEditing={true} onChange={jest.fn()} />);

    expect(screen.getByRole('combobox', { name: 'Code language' })).toHaveDisplayValue('PromQL');
  });

  // The picker is the only way to set a language, and it offers ten. Anything else has to be typeable
  // or those cells cannot be authored at all.
  it('accepts a language it does not offer', async () => {
    const onChange = jest.fn();
    const { user } = render(<CodeCell content={content} isEditing={true} onChange={onChange} />);

    // `{selectall}` first: the picker shows the current language, and Combobox keeps that as its
    // search text, so typing alone would search for `SQLRust`.
    await user.type(screen.getByRole('combobox', { name: 'Code language' }), '{selectall}Rust');
    await user.click(screen.getByRole('option', { name: /Rust/ }));

    // Normalised on the way in, so it matches the offered spelling if highlighting for it ever lands.
    expect(onChange).toHaveBeenCalledWith({ kind: 'Code', spec: { code: 'select 1', language: 'rust' } });
  });

  // Filtered rather than read off the open list: the list is virtualised, so the last of the ten
  // options is below the fold in jsdom.
  it.each([
    ['prom', 'PromQL'],
    ['log', 'LogQL'],
  ])('offers %s as %s, so an observability cell can be authored', async (search, label) => {
    const { user } = render(<CodeCell content={content} isEditing={true} onChange={jest.fn()} />);

    await user.type(screen.getByRole('combobox', { name: 'Code language' }), `{selectall}${search}`);

    expect(screen.getByRole('option', { name: label })).toBeInTheDocument();
  });

  // Authored elsewhere as `yml`: it highlights as YAML, so the picker has to show YAML rather than an
  // empty control.
  it('shows the resolved language for a cell stored with an alias', () => {
    const yml: CellContentKind = { kind: 'Code', spec: { code: 'a: 1', language: 'yml' } };
    render(<CodeCell content={yml} isEditing={true} onChange={jest.fn()} />);

    expect(screen.getByRole('combobox', { name: 'Code language' })).toHaveDisplayValue('YAML');
  });
});

import { render, screen } from 'test/test-utils';

import { type CellContentKind } from 'app/features/notebook/types';

import { MarkdownCellEditor } from './MarkdownCellEditor';

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
        if (!extensions || extensions.length < 3) {
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

describe('MarkdownCellEditor', () => {
  it('uses notebook history instead of a separate CodeMirror history', () => {
    render(<MarkdownCellEditor content={content} onChange={jest.fn()} />);

    expect(screen.getByLabelText('Markdown')).toHaveAttribute('data-native-history', 'disabled');
  });

  it('reports edits back as markdown content', async () => {
    const onChange = jest.fn();
    const { user } = render(<MarkdownCellEditor content={content} onChange={onChange} />);

    await user.type(screen.getByLabelText('Markdown'), '!');

    expect(onChange).toHaveBeenLastCalledWith({ kind: 'Markdown', spec: { text: '**bold**!' } });
  });

  it('preserves schema fields the cell does not render', async () => {
    const annotated = { kind: 'Markdown', spec: { text: '**bold**', extra: 'kept' } } as unknown as CellContentKind;
    const onChange = jest.fn();
    const { user } = render(<MarkdownCellEditor content={annotated} onChange={onChange} />);

    await user.type(screen.getByLabelText('Markdown'), '!');

    expect(onChange).toHaveBeenLastCalledWith({ kind: 'Markdown', spec: { text: '**bold**!', extra: 'kept' } });
  });
});

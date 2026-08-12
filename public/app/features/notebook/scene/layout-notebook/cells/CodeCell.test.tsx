import { render, screen } from 'test/test-utils';

import { mockComboboxRect } from '@grafana/test-utils';
import { type CellContentKind } from 'app/features/notebook/types';

import { CodeCell } from './CodeCell';

// The real CodeMirrorEditor is a heavy, lazily loaded bundle that does not run in jsdom. A textarea
// carries readOnly into the DOM, so the assertions are on rendered output rather than on props
// handed to a stub. Only the editor is replaced: the rest of the module is reachable from this
// test's import tree (attachSkeleton, via the dashboard scene), and a wholesale mock takes it down.
jest.mock('@grafana/ui/unstable', () => ({
  ...jest.requireActual('@grafana/ui/unstable'),
  CodeMirrorEditor: ({
    value,
    readOnly,
    onChange,
    'aria-label': ariaLabel,
  }: {
    value: string;
    readOnly?: boolean;
    onChange: (value: string) => void;
    'aria-label'?: string;
  }) => (
    <textarea aria-label={ariaLabel} value={value} readOnly={readOnly} onChange={(e) => onChange(e.target.value)} />
  ),
}));

// Combobox virtualizes its list, which needs measurable elements in jsdom.
mockComboboxRect();

const content: CellContentKind = { kind: 'Code', spec: { code: 'select 1', language: 'sql' } };

describe('CodeCell', () => {
  it('is read only while the notebook is being read', () => {
    render(<CodeCell content={content} isEditing={false} onChange={jest.fn()} />);

    expect(screen.getByLabelText('Code')).toHaveAttribute('readonly');
  });

  it('takes input once the notebook is being edited', () => {
    render(<CodeCell content={content} isEditing={true} onChange={jest.fn()} />);

    expect(screen.getByLabelText('Code')).not.toHaveAttribute('readonly');
  });

  it('labels the cell with its language while reading, without offering the picker', () => {
    render(<CodeCell content={content} isEditing={false} onChange={jest.fn()} />);

    expect(screen.getByText('SQL')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('falls back to a generic label when the cell has no language', () => {
    const plain: CellContentKind = { kind: 'Code', spec: { code: 'hello', language: '' } };
    render(<CodeCell content={plain} isEditing={false} onChange={jest.fn()} />);

    expect(screen.getByText('code')).toBeInTheDocument();
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

  it('shows a language it cannot highlight rather than an empty picker', () => {
    const promql: CellContentKind = { kind: 'Code', spec: { code: 'up', language: 'promql' } };
    render(<CodeCell content={promql} isEditing={true} onChange={jest.fn()} />);

    expect(screen.getByRole('combobox', { name: 'Code language' })).toHaveDisplayValue('promql');
  });
});

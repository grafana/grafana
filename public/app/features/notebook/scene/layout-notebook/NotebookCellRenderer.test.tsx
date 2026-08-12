import { render, screen } from 'test/test-utils';

import { NotebookCellItem } from './NotebookCellItem';
import { NotebookCellRenderer } from './NotebookCellRenderer';

// See CodeCell.test.tsx — the real editor does not run in jsdom.
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

function buildCodeCell() {
  return new NotebookCellItem({
    elementName: 'code-1',
    source: 'user',
    content: { kind: 'Code', spec: { code: 'select 1', language: 'sql' } },
  });
}

describe('NotebookCellRenderer', () => {
  it('hands an edit to the layout manager rather than writing it to the cell', async () => {
    const cell = buildCodeCell();
    const onContentChange = jest.fn();
    const { user } = render(<NotebookCellRenderer cell={cell} isEditing={true} onContentChange={onContentChange} />);

    await user.type(screen.getByLabelText('Code'), '0');

    // The manager applies it, because cells sharing an element have to move together.
    expect(onContentChange).toHaveBeenLastCalledWith(cell, {
      kind: 'Code',
      spec: { code: 'select 10', language: 'sql' },
    });
    expect(cell.state.content).toEqual({ kind: 'Code', spec: { code: 'select 1', language: 'sql' } });
  });

  it('leaves the cell alone while the notebook is being read', () => {
    const cell = buildCodeCell();
    const onContentChange = jest.fn();
    render(<NotebookCellRenderer cell={cell} isEditing={false} onContentChange={onContentChange} />);

    expect(screen.getByLabelText('Code')).toHaveAttribute('readonly');
    expect(onContentChange).not.toHaveBeenCalled();
  });
});

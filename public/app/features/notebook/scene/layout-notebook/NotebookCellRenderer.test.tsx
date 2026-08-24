import { render, screen } from 'test/test-utils';

import { NotebookCellItem } from './NotebookCellItem';
import { NotebookCellRenderer } from './NotebookCellRenderer';
import { NotebookLayoutManager } from './NotebookLayoutManager';

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

/** A cell reaches its layout manager through the scene graph, so it has to actually be in one. */
function buildCellInLayout() {
  const cell = buildCodeCell();
  new NotebookLayoutManager({ cells: [cell] });

  return cell;
}

describe('NotebookCellRenderer', () => {
  // The edit goes out through the cell to its layout manager, which applies it — cells sharing an
  // element have to move together, and only the manager can see the siblings.
  it('routes an edit through the layout manager onto the cell', async () => {
    const cell = buildCellInLayout();
    const { user } = render(<NotebookCellRenderer cell={cell} isEditing={true} />);

    await user.type(await screen.findByLabelText('Code'), '0');

    expect(cell.state.content).toEqual({ kind: 'Code', spec: { code: 'select 10', language: 'sql' } });
  });

  it('leaves the cell alone while the notebook is being read', async () => {
    const cell = buildCellInLayout();
    render(<NotebookCellRenderer cell={cell} isEditing={false} />);

    expect(await screen.findByLabelText('Code')).toHaveAttribute('readonly');
    expect(cell.state.content).toEqual({ kind: 'Code', spec: { code: 'select 1', language: 'sql' } });
  });

  // A cell outside a layout is a wiring mistake. Failing loudly beats an editor that silently drops
  // what the reader types.
  it('refuses an edit from a cell that is not inside a layout', () => {
    const orphan = buildCodeCell();

    expect(() => orphan.onContentChange({ kind: 'Code', spec: { code: 'x', language: 'sql' } })).toThrow(
      /not inside a NotebookLayoutManager/
    );
  });
});

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

function buildMarkdownCell(text = '') {
  return new NotebookCellItem({
    elementName: 'md-1',
    source: 'user',
    content: { kind: 'Markdown', spec: { text } },
  });
}

/** A cell reaches its layout manager through the scene graph, so it has to actually be in one. */
function buildCellInLayout() {
  const cell = buildCodeCell();
  new NotebookLayoutManager({ cells: [cell] });

  return cell;
}

function buildMarkdownCellInLayout(text?: string) {
  const cell = buildMarkdownCell(text);
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

  describe('the "/" block-type menu', () => {
    it('opens on a lone "/" and offers every block type', async () => {
      const cell = buildMarkdownCellInLayout();
      const { user } = render(<NotebookCellRenderer cell={cell} isEditing={true} />);

      await user.type(await screen.findByLabelText('Markdown'), '/');

      expect(screen.getByRole('menu')).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Heading' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Paragraph' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Code' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Visualization' })).toHaveAttribute('aria-haspopup', 'menu');
    });

    it('never opens for ordinary typing', async () => {
      const cell = buildMarkdownCellInLayout();
      const { user } = render(<NotebookCellRenderer cell={cell} isEditing={true} />);

      await user.type(await screen.findByLabelText('Markdown'), 'Hello');

      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    // The exact bug fixed earlier this session: the menu opening but never closing again once the "/"
    // it was keyed off was gone.
    it('closes once the "/" is backspaced away', async () => {
      const cell = buildMarkdownCellInLayout();
      const { user } = render(<NotebookCellRenderer cell={cell} isEditing={true} />);

      const editor = await screen.findByLabelText('Markdown');
      await user.type(editor, '/');
      expect(screen.getByRole('menu')).toBeInTheDocument();

      await user.type(editor, '{Backspace}');
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    // useDismiss's default outside-press handling has to replicate what the hand-rolled listener it
    // replaced used to do — dismiss on a press outside both the cell and the menu itself.
    it('closes on an outside click', async () => {
      const cell = buildMarkdownCellInLayout();
      const { user } = render(
        <div>
          <NotebookCellRenderer cell={cell} isEditing={true} />
          <button>Outside</button>
        </div>
      );

      await user.type(await screen.findByLabelText('Markdown'), '/');
      expect(screen.getByRole('menu')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Outside' }));
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('closes on Escape', async () => {
      const cell = buildMarkdownCellInLayout();
      const { user } = render(<NotebookCellRenderer cell={cell} isEditing={true} />);

      await user.type(await screen.findByLabelText('Markdown'), '/');
      expect(screen.getByRole('menu')).toBeInTheDocument();

      await user.keyboard('{Escape}');
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    // useDismiss excludes presses on the reference element by default — the cell's own container,
    // wired as the reference — so continuing to interact with the editor itself must not be mistaken
    // for an outside press.
    it('stays open for a press back inside the cell that opened it', async () => {
      const cell = buildMarkdownCellInLayout();
      const { user } = render(<NotebookCellRenderer cell={cell} isEditing={true} />);

      const editor = await screen.findByLabelText('Markdown');
      await user.type(editor, '/');
      expect(screen.getByRole('menu')).toBeInTheDocument();

      await user.click(editor);
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('converts the cell and closes the menu when a type is picked', async () => {
      const cell = buildMarkdownCellInLayout();
      const { user } = render(<NotebookCellRenderer cell={cell} isEditing={true} />);

      await user.type(await screen.findByLabelText('Markdown'), '/');
      await user.click(screen.getByRole('menuitem', { name: 'Paragraph' }));

      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(cell.state.content).toEqual({ kind: 'Markdown', spec: { text: '' } });
    });

    // Picking a type that keeps content.kind the same (Paragraph, Heading) converts this cell in
    // place rather than mounting a different one — the caret has nowhere else to go but back here.
    it('asks for focus back after picking a type that keeps this cell mounted', async () => {
      const cell = buildMarkdownCellInLayout();
      const onFocusRequest = jest.fn();
      const { user } = render(<NotebookCellRenderer cell={cell} isEditing={true} onFocusRequest={onFocusRequest} />);

      await user.type(await screen.findByLabelText('Markdown'), '/');
      await user.click(screen.getByRole('menuitem', { name: 'Heading' }));

      expect(onFocusRequest).toHaveBeenCalledTimes(1);
    });
  });
});

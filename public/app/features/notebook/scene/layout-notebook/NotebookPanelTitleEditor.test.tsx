import { fireEvent, render, screen } from 'test/test-utils';

import { VizPanel } from '@grafana/scenes';

import { NotebookCellItem } from './NotebookCellItem';
import { NotebookLayoutManager } from './NotebookLayoutManager';
import { NotebookPanelTitleEditor } from './NotebookPanelTitleEditor';

function setup(panelTitle = 'p95 latency', isEditing = true) {
  const panel = new VizPanel({ key: 'panel-1', pluginId: 'timeseries' });
  const cell = new NotebookCellItem({ elementName: 'panel-1', source: 'user', panelTitle, body: panel });
  // Gives onPanelTitleChange/onPanelTitleCommit a layout manager to delegate to.
  new NotebookLayoutManager({ cells: [cell] });

  const rendered = render(<NotebookPanelTitleEditor cell={cell} isEditing={isEditing} />);
  return { ...rendered, cell };
}

// Named by its fixed tooltip, not its (variable) displayed text - see NotebookTitleEditor.test.tsx's
// own getTrigger for the same convention.
function getTrigger() {
  return screen.getByRole('button', { name: 'Edit panel title' });
}

function getInput() {
  return screen.getByRole('textbox', { name: 'Panel title' });
}

describe('NotebookPanelTitleEditor', () => {
  describe('in view mode', () => {
    it('shows the title as plain text, not a control', () => {
      setup('p95 latency', false);

      expect(screen.getByRole('heading', { name: 'p95 latency' })).toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    // Nothing for a reader to click, so there's nothing to prompt them with either.
    it('shows nothing at all when there is no title', () => {
      setup('', false);

      expect(screen.queryByRole('heading')).not.toBeInTheDocument();
      expect(screen.queryByText('Add a title')).not.toBeInTheDocument();
    });
  });

  describe('in edit mode', () => {
    it('is a button, and the button itself is the way in', () => {
      setup();

      expect(getTrigger()).toHaveTextContent('p95 latency');
    });

    it('offers "Add a title" when there is no title yet', () => {
      setup('');

      expect(getTrigger()).toHaveTextContent('Add a title');
    });

    it('opens a field holding the title, with the text already selected', async () => {
      const { user } = setup();

      await user.click(getTrigger());

      const input = getInput();
      expect(input).toHaveValue('p95 latency');
      expect(input).toHaveFocus();
      expect(input).toHaveProperty('selectionStart', 0);
      expect(input).toHaveProperty('selectionEnd', 'p95 latency'.length);
    });

    it('reports every keystroke, trimmed', async () => {
      const { user, cell } = setup();

      await user.click(getTrigger());
      await user.clear(getInput());
      await user.type(getInput(), '  Errors  ');

      expect(cell.state.panelTitle).toBe('Errors');
    });

    it('closes back to the button on blur', async () => {
      const { user } = setup();

      await user.click(getTrigger());
      await user.clear(getInput());
      await user.type(getInput(), 'Errors');
      await user.click(document.body);

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(getTrigger()).toHaveTextContent('Errors');
    });

    it('closes back to the button on Enter', async () => {
      const { user } = setup();

      await user.click(getTrigger());
      await user.clear(getInput());
      await user.type(getInput(), 'Errors{enter}');

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(getTrigger()).toHaveTextContent('Errors');
    });

    // Unlike the notebook's own title, an empty panel title is a normal, valid state - there is
    // nothing here to refuse or show an error for.
    it('clears to the placeholder when emptied and closed', async () => {
      const { user, cell } = setup();

      await user.click(getTrigger());
      await user.clear(getInput());
      await user.click(document.body);

      expect(cell.state.panelTitle).toBe('');
      expect(getTrigger()).toHaveTextContent('Add a title');
    });

    it('puts back the title the edit started from on Escape', async () => {
      const { user, cell } = setup();

      await user.click(getTrigger());
      await user.clear(getInput());
      await user.type(getInput(), 'Errors');
      await user.keyboard('{Escape}');

      expect(cell.state.panelTitle).toBe('p95 latency');
      expect(getTrigger()).toHaveTextContent('p95 latency');
    });

    // An IME sends both while composing - Enter to confirm the candidate, Escape to abandon it -
    // and neither is meant for the field. fireEvent rather than `user`, which cannot set isComposing.
    describe('while an IME composition is in progress', () => {
      it.each(['Enter', 'Escape'])('leaves the field open on %s', async (key) => {
        const { user } = setup();

        await user.click(getTrigger());
        await user.clear(getInput());
        await user.type(getInput(), 'Err');
        fireEvent.keyDown(getInput(), { key, isComposing: true });

        expect(getInput()).toBeInTheDocument();
        expect(getInput()).toHaveValue('Err');
      });
    });
  });

  // The notebook's own Done button can leave edit mode without this field ever blurring.
  it('closes the field rather than leaving it open when edit mode is left mid-rename', async () => {
    const { user, rerender, cell } = setup();

    await user.click(getTrigger());
    expect(getInput()).toBeInTheDocument();

    rerender(<NotebookPanelTitleEditor cell={cell} isEditing={false} />);

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});

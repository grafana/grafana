import { act, render, screen, waitFor } from 'test/test-utils';

import { NotebookCellActions } from './NotebookCellActions';
import { NOTEBOOK_CELL_CONTROLS_PINNED_CLASS } from './cellClassNames';

describe('NotebookCellActions', () => {
  it.each(['Duplicate block', 'Delete block'])('invokes %s and closes the menu', async (action) => {
    const onDuplicate = jest.fn();
    const onDelete = jest.fn();
    const { user } = render(<NotebookCellActions inline onDuplicate={onDuplicate} onDelete={onDelete} />);
    const trigger = screen.getByRole('button', { name: 'Block actions' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);
    await user.click(await screen.findByRole('menuitem', { name: action }));

    expect(onDuplicate).toHaveBeenCalledTimes(action === 'Duplicate block' ? 1 : 0);
    expect(onDelete).toHaveBeenCalledTimes(action === 'Delete block' ? 1 : 0);
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('keeps the trigger revealed while its menu is open and restores focus on Escape', async () => {
    const { user } = render(<NotebookCellActions onDuplicate={jest.fn()} onDelete={jest.fn()} />);
    const trigger = screen.getByRole('button', { name: 'Block actions' });

    act(() => trigger.focus());
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('menuitem', { name: 'Duplicate block' })).toBeInTheDocument();
    expect(trigger.parentElement).toHaveClass(NOTEBOOK_CELL_CONTROLS_PINNED_CLASS);
    await user.keyboard('{Escape}');

    await waitFor(() => expect(trigger).toHaveFocus());
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger.parentElement).not.toHaveClass(NOTEBOOK_CELL_CONTROLS_PINNED_CLASS);
  });
});

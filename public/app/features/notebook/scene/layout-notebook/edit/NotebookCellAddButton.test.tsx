import { act, fireEvent, render, screen } from 'test/test-utils';

import { NotebookCellAddButton } from './NotebookCellAddButton';

// Not currently wired into NotebookCellFrame (see nmarrs's PR #131813 review: the per-cell "+" and its
// alt/option-click "insert above" gesture aren't discoverable enough to ship yet, and NotebookCellFrame
// went back to NotebookAddBlockDivider). Kept, and kept tested, for when that's revisited.
describe('NotebookCellAddButton', () => {
  it('renders an accessible add-block trigger', () => {
    render(<NotebookCellAddButton index={1} />);

    expect(screen.getByRole('button', { name: 'Add block' })).toBeInTheDocument();
  });

  // The only behavioural pin on the insertion index. A plain click inserts below (index + 1); an
  // alt/option-click inserts above (index) — an off-by-one here would silently insert blocks in the
  // wrong place once this is wired back up.
  it('inserts below its own cell on a plain click', async () => {
    const onAdd = jest.fn();
    const { user } = render(<NotebookCellAddButton index={1} onAdd={onAdd} />);

    await user.click(screen.getByRole('button', { name: 'Add block' }));
    await user.click(screen.getByRole('menuitem', { name: 'Heading' }));

    expect(onAdd).toHaveBeenCalledWith('heading', 2);
  });

  it('inserts above its own cell on an alt/option-click', async () => {
    const onAdd = jest.fn();
    const { user } = render(<NotebookCellAddButton index={1} onAdd={onAdd} />);

    // The modifier is read on mouseUp, not click — see the component's own comment on why — and the
    // click that follows is what actually opens the menu (Dropdown's own useClick interaction).
    const addButton = screen.getByRole('button', { name: 'Add block' });
    fireEvent.mouseUp(addButton, { altKey: true });
    fireEvent.click(addButton, { altKey: true });
    await user.click(screen.getByRole('menuitem', { name: 'Heading' }));

    expect(onAdd).toHaveBeenCalledWith('heading', 1);
  });

  // Keyboard activation (Enter/Space) never fires mouseUp, so a cell that moved after mount —
  // something inserted, deleted, or reordered above it — would otherwise keep offering its stale
  // former position instead of its current one.
  it('inserts at the current position after the cell moves, even without a prior mouse interaction', async () => {
    const onAdd = jest.fn();
    const { user, rerender } = render(<NotebookCellAddButton index={1} onAdd={onAdd} />);

    rerender(<NotebookCellAddButton index={2} onAdd={onAdd} />);

    // IconButton's own Tooltip reacts to focus (floating-ui's useFocus), so the imperative .focus()
    // call itself needs to be inside act(), same as any other state-updating event in this test.
    act(() => {
      screen.getByRole('button', { name: 'Add block' }).focus();
    });
    await user.keyboard('{Enter}');
    await user.click(screen.getByRole('menuitem', { name: 'Heading' }));

    expect(onAdd).toHaveBeenCalledWith('heading', 3);
  });

  // Opening the menu moves focus into its own Portal (see Dropdown's FloatingFocusManager), which
  // sits outside this component's own wrapper — breaking a hover/focus-based reveal and fading the
  // trigger back out mid-interaction without this. jsdom doesn't evaluate :focus-within anyway, so
  // this pins the explicit override the component applies instead of the collision itself.
  it('stays revealed while its own menu is open', async () => {
    const { user } = render(<NotebookCellAddButton index={1} />);
    // Grabbed before opening: once the menu is open, Dropdown's FloatingFocusManager marks the
    // trigger aria-hidden (correct modal behaviour), so it's no longer findable by role afterwards.
    const addButton = screen.getByRole('button', { name: 'Add block' });
    const wrapper = addButton.closest('div');

    await user.click(addButton);

    expect(getComputedStyle(wrapper!).opacity).toBe('1');
  });
});

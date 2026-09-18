import { render, screen } from 'test/test-utils';

import { NotebookCellAddButton } from './NotebookCellAddButton';

describe('NotebookCellAddButton', () => {
  it('renders an accessible add-block trigger', () => {
    render(<NotebookCellAddButton index={1} />);

    expect(screen.getByRole('button', { name: 'Click to add below' })).toBeInTheDocument();
  });

  // The only behavioural pin on the insertion index. The button at position i always inserts at
  // i + 1 — an off-by-one here would silently insert blocks in the wrong place.
  it('inserts below its own cell', async () => {
    const onAdd = jest.fn();
    const { user } = render(<NotebookCellAddButton index={1} onAdd={onAdd} />);

    await user.click(screen.getByRole('button', { name: 'Click to add below' }));
    await user.click(screen.getByRole('menuitem', { name: 'Heading' }));

    expect(onAdd).toHaveBeenCalledWith('heading', 2);
  });

  // Opening the menu moves focus into its own Portal (see Dropdown's FloatingFocusManager), which
  // sits outside this component's own wrapper — breaking a hover/focus-based reveal and fading the
  // trigger back out mid-interaction without this. jsdom doesn't evaluate :focus-within anyway, so
  // this pins the explicit override the component applies instead of the collision itself.
  it('stays revealed while its own menu is open', async () => {
    const { user } = render(<NotebookCellAddButton index={1} />);
    // Grabbed before opening: once the menu is open, Dropdown's FloatingFocusManager marks the
    // trigger aria-hidden (correct modal behaviour), so it's no longer findable by role afterwards.
    const addButton = screen.getByRole('button', { name: 'Click to add below' });
    const wrapper = addButton.closest('div');

    await user.click(addButton);

    expect(getComputedStyle(wrapper!).opacity).toBe('1');
  });
});

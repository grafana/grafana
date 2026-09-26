import { fireEvent, render, screen, within } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { contextSrv } from 'app/core/services/context_srv';
import { useQueryLibraryContext } from 'app/features/explore/QueryLibrary/QueryLibraryContext';

import { NotebookCellAddButton } from './NotebookCellAddButton';
import { NOTEBOOK_CELL_CONTROLS_PINNED_CLASS } from './cellClassNames';

jest.mock('app/features/explore/QueryLibrary/QueryLibraryContext', () => ({
  useQueryLibraryContext: jest.fn(),
}));

const mockUseQueryLibraryContext = useQueryLibraryContext as jest.Mock;

beforeEach(() => {
  mockUseQueryLibraryContext.mockReturnValue({ queryLibraryEnabled: true });
  contextSrv.isSignedIn = true;
});

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
    // The cell list hides the controls on every cell the pointer is not over. This class is how the
    // trigger opts out of that rule for as long as its menu is open.
    expect(wrapper).toHaveClass(NOTEBOOK_CELL_CONTROLS_PINNED_CLASS);
  });

  // keyDown rather than user.type: typing clicks first, and any click inside the overlay closes the
  // Dropdown (see IrmMenuItem.test.tsx for why activation itself isn't reachable in jsdom).
  it('offers "New from Saved Queries" under Visualization when onAddSavedQuery is given', async () => {
    const { user } = render(<NotebookCellAddButton index={1} onAddSavedQuery={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Click to add below' }));
    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Visualization' }), { key: 'ArrowRight' });

    const submenu = within(await screen.findByTestId(selectors.components.Menu.SubMenu.container));
    expect(submenu.getByRole('menuitem', { name: 'New from Saved Queries' })).toBeInTheDocument();
  });

  it('does not offer "New from Saved Queries" when onAddSavedQuery is omitted', async () => {
    const { user } = render(<NotebookCellAddButton index={1} />);

    await user.click(screen.getByRole('button', { name: 'Click to add below' }));

    expect(screen.getByRole('menuitem', { name: 'Visualization' })).not.toHaveAttribute('aria-haspopup');
  });
});

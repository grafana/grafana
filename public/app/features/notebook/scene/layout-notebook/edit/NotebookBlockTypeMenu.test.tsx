import { render, screen, within } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { contextSrv } from 'app/core/services/context_srv';
import { useQueryLibraryContext } from 'app/features/explore/QueryLibrary/QueryLibraryContext';

import { NotebookBlockTypeMenu } from './NotebookBlockTypeMenu';

jest.mock('app/features/explore/QueryLibrary/QueryLibraryContext', () => ({
  useQueryLibraryContext: jest.fn(),
}));

const mockUseQueryLibraryContext = useQueryLibraryContext as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseQueryLibraryContext.mockReturnValue({ queryLibraryEnabled: true });
  jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
});

/** Opens the Visualization item's submenu and returns it, scoped. Contents only — see IrmMenuItem.test.tsx for why activation itself isn't reachable in jsdom. */
async function openVisualizationSubmenu(user: ReturnType<typeof render>['user']) {
  await user.type(screen.getByRole('menuitem', { name: 'Visualization' }), '{ArrowRight}');
  return within(await screen.findByTestId(selectors.components.Menu.SubMenu.container));
}

describe('NotebookBlockTypeMenu', () => {
  it('renders one item per block type', () => {
    render(<NotebookBlockTypeMenu />);

    expect(screen.getByRole('menuitem', { name: 'Heading' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Paragraph' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Code' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Visualization' })).toBeInTheDocument();
  });

  // Menu.Item's onClick still fires with childItems set — the row itself must keep working.
  it('clicking Visualization directly still inserts a plain visualization block', async () => {
    const onPick = jest.fn();
    const { user } = render(<NotebookBlockTypeMenu onPick={onPick} onPickSavedQuery={jest.fn()} />);

    await user.click(screen.getByRole('menuitem', { name: 'Visualization' }));

    expect(onPick).toHaveBeenCalledWith('visualization');
  });

  describe('when saved queries are available and onPickSavedQuery is provided', () => {
    it('offers "New Visualization" and "New from Saved Queries" as Visualization sub-options', async () => {
      const { user } = render(<NotebookBlockTypeMenu onPick={jest.fn()} onPickSavedQuery={jest.fn()} />);

      const submenu = await openVisualizationSubmenu(user);

      expect(submenu.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
        'New Visualization',
        'New from Saved Queries',
      ]);
    });
  });

  describe('when saved queries are unavailable', () => {
    it('does not add a submenu when the query library is disabled', () => {
      mockUseQueryLibraryContext.mockReturnValue({ queryLibraryEnabled: false });
      render(<NotebookBlockTypeMenu onPick={jest.fn()} onPickSavedQuery={jest.fn()} />);

      expect(screen.getByRole('menuitem', { name: 'Visualization' })).not.toHaveAttribute('aria-haspopup');
    });

    it('does not add a submenu when the user lacks read permission', () => {
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
      render(<NotebookBlockTypeMenu onPick={jest.fn()} onPickSavedQuery={jest.fn()} />);

      expect(screen.getByRole('menuitem', { name: 'Visualization' })).not.toHaveAttribute('aria-haspopup');
    });

    it('does not add a submenu when no onPickSavedQuery is given', () => {
      render(<NotebookBlockTypeMenu onPick={jest.fn()} />);

      expect(screen.getByRole('menuitem', { name: 'Visualization' })).not.toHaveAttribute('aria-haspopup');
    });
  });

  it('opens with focus on the first block type', () => {
    render(<NotebookBlockTypeMenu />);

    expect(screen.getByRole('menuitem', { name: 'Heading' })).toHaveFocus();
  });

  it('jumps to the block type matching a typed letter', async () => {
    const { user } = render(<NotebookBlockTypeMenu />);

    await user.keyboard('v');
    expect(screen.getByRole('menuitem', { name: 'Visualization' })).toHaveFocus();

    await user.keyboard('H');
    expect(screen.getByRole('menuitem', { name: 'Heading' })).toHaveFocus();
  });

  it('leaves focus in place when no block type matches', async () => {
    const { user } = render(<NotebookBlockTypeMenu />);

    await user.keyboard('z');

    expect(screen.getByRole('menuitem', { name: 'Heading' })).toHaveFocus();
  });

  it('moves down and up with Ctrl+N and Ctrl+P, wrapping at the ends', async () => {
    const { user } = render(<NotebookBlockTypeMenu />);

    await user.keyboard('{Control>}n{/Control}');
    expect(screen.getByRole('menuitem', { name: 'Paragraph' })).toHaveFocus();

    await user.keyboard('{Control>}p{/Control}{Control>}p{/Control}');
    expect(screen.getByRole('menuitem', { name: 'Visualization' })).toHaveFocus();
  });

  // With Caps Lock on, event.key is uppercase; missing that would let Ctrl+P open the print dialog.
  it('handles Ctrl+N/P with Caps Lock on', async () => {
    const { user } = render(<NotebookBlockTypeMenu />);

    await user.keyboard('{CapsLock}{Control>}n{/Control}');
    expect(screen.getByRole('menuitem', { name: 'Paragraph' })).toHaveFocus();

    await user.keyboard('{Control>}p{/Control}');
    expect(screen.getByRole('menuitem', { name: 'Heading' })).toHaveFocus();
  });

  it('wraps forward from the last block type with Ctrl+N', async () => {
    const { user } = render(<NotebookBlockTypeMenu />);

    await user.keyboard('v{Control>}n{/Control}');

    expect(screen.getByRole('menuitem', { name: 'Heading' })).toHaveFocus();
  });

  it('picks the focused block type with Enter after Ctrl+N/P', async () => {
    const onPick = jest.fn();
    const { user } = render(<NotebookBlockTypeMenu onPick={onPick} />);

    await user.keyboard('{Control>}n{/Control}{Enter}');
    expect(onPick).toHaveBeenLastCalledWith('paragraph');

    await user.keyboard('{Control>}p{/Control}{Control>}p{/Control}{Enter}');
    expect(onPick).toHaveBeenLastCalledWith('visualization');
  });

  // Focus moves through Menu's own index; focusing an item directly would desync it and the next
  // arrow press would step from the item focused before the jump.
  it('continues arrow navigation from the item a letter jumped to', async () => {
    const { user } = render(<NotebookBlockTypeMenu />);

    await user.keyboard('c');
    await user.keyboard('{ArrowDown}');

    expect(screen.getByRole('menuitem', { name: 'Visualization' })).toHaveFocus();
  });

  it('picks the focused block type with Enter after a letter jump', async () => {
    const onPick = jest.fn();
    const { user } = render(<NotebookBlockTypeMenu onPick={onPick} />);

    await user.keyboard('c{Enter}');

    expect(onPick).toHaveBeenCalledWith('code');
  });
});

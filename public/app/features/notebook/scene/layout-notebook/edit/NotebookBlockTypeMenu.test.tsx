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
  contextSrv.isSignedIn = true;
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
      contextSrv.isSignedIn = false;
      render(<NotebookBlockTypeMenu onPick={jest.fn()} onPickSavedQuery={jest.fn()} />);

      expect(screen.getByRole('menuitem', { name: 'Visualization' })).not.toHaveAttribute('aria-haspopup');
    });

    it('does not add a submenu when no onPickSavedQuery is given', () => {
      render(<NotebookBlockTypeMenu onPick={jest.fn()} />);

      expect(screen.getByRole('menuitem', { name: 'Visualization' })).not.toHaveAttribute('aria-haspopup');
    });
  });
});

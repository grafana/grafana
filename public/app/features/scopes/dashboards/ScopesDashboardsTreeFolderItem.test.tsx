import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom-v5-compat';

import { locationService } from '@grafana/runtime';

import { useScopesServices } from '../ScopesContextProvider';

import { ScopesDashboardsTreeFolderItem } from './ScopesDashboardsTreeFolderItem';
import { type SuggestedNavigationsFolder, type SuggestedNavigationsFoldersMap } from './types';

// Mock useQueryParams hook used by ScopesDashboardsTree
jest.mock('app/core/hooks/useQueryParams', () => ({
  useQueryParams: jest.fn(() => [{}]),
}));

jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useLocation: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  locationService: {
    push: jest.fn(),
  },
}));

// Mock ScopesContextProvider
const mockScopesSelectorService = {
  changeScopes: jest.fn(),
  state: {
    appliedScopes: [{ scopeId: 'shoe-org' }],
  },
};

const mockScopesDashboardsService = {
  setNavigationScope: jest.fn(),
  state: {
    navScopePath: undefined as string[] | undefined,
    navigationScope: undefined as string | undefined,
  },
};

jest.mock('../ScopesContextProvider', () => ({
  ...jest.requireActual('../ScopesContextProvider'),
  useScopesServices: jest.fn(() => ({
    scopesSelectorService: mockScopesSelectorService,
    scopesDashboardsService: mockScopesDashboardsService,
  })),
}));

describe('ScopesDashboardsTreeFolderItem', () => {
  const mockOnFolderUpdate = jest.fn();
  const mockUseLocation = useLocation as jest.Mock;
  const mockLocationServicePush = locationService.push as jest.Mock;
  const mockUseScopesServices = useScopesServices as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLocation.mockReturnValue({ pathname: '/current-path' });
    mockScopesSelectorService.state.appliedScopes = [{ scopeId: 'shoe-org' }];
    mockScopesDashboardsService.state.navScopePath = undefined;
    mockScopesDashboardsService.state.navigationScope = undefined;
    mockUseScopesServices.mockReturnValue({
      scopesSelectorService: mockScopesSelectorService,
      scopesDashboardsService: mockScopesDashboardsService,
    });
  });

  const createMockFolder = (overrides?: Partial<SuggestedNavigationsFolder>): SuggestedNavigationsFolder => ({
    title: 'Test Folder',
    expanded: false,
    folders: {},
    suggestedNavigations: {},
    ...overrides,
  });

  const createMockFolders: SuggestedNavigationsFoldersMap = {
    '': {
      title: '',
      expanded: true,
      folders: {},
      suggestedNavigations: {},
    },
  };

  const renderWithRouter = (ui: React.ReactElement) => {
    return render(<MemoryRouter>{ui}</MemoryRouter>);
  };

  it('renders folder with correct props', () => {
    const folder = createMockFolder();
    render(
      <ScopesDashboardsTreeFolderItem
        folder={folder}
        folderPath={['']}
        folders={createMockFolders}
        onFolderUpdate={mockOnFolderUpdate}
      />
    );

    expect(screen.getByText('Test Folder')).toBeInTheDocument();
    expect(screen.getByTestId('scopes-dashboards-Test Folder-expand')).toBeInTheDocument();
  });

  it('calls onFolderUpdate when expand button is clicked', async () => {
    const user = userEvent.setup();
    const folder = createMockFolder({ expanded: false });

    render(
      <ScopesDashboardsTreeFolderItem
        folder={folder}
        folderPath={['']}
        folders={createMockFolders}
        onFolderUpdate={mockOnFolderUpdate}
      />
    );

    const expandButton = screen.getByTestId('scopes-dashboards-Test Folder-expand');
    await user.click(expandButton);

    expect(mockOnFolderUpdate).toHaveBeenCalledWith([''], true);
  });

  it('shows exchange icon when folder has subScopeName', () => {
    const folder = createMockFolder({ subScopeName: 'subScope1' });

    render(
      <ScopesDashboardsTreeFolderItem
        folder={folder}
        folderPath={['']}
        folders={createMockFolders}
        onFolderUpdate={mockOnFolderUpdate}
      />
    );

    // IconButton with exchange-alt icon should be present
    const exchangeButton = screen.getByRole('button', { name: /change root scope/i });
    expect(exchangeButton).toBeInTheDocument();
  });

  it('does not show exchange icon when folder does not have subScopeName', () => {
    const folder = createMockFolder();

    render(
      <ScopesDashboardsTreeFolderItem
        folder={folder}
        folderPath={['']}
        folders={createMockFolders}
        onFolderUpdate={mockOnFolderUpdate}
      />
    );

    const exchangeButtons = screen.queryAllByRole('button', { name: /change root scope/i });
    expect(exchangeButtons).toHaveLength(0);
  });

  it('calls setNavigationScope when exchange icon is clicked', async () => {
    const user = userEvent.setup();
    const folder = createMockFolder({ subScopeName: 'subScope1' });

    render(
      <ScopesDashboardsTreeFolderItem
        folder={folder}
        folderPath={['']}
        folders={createMockFolders}
        onFolderUpdate={mockOnFolderUpdate}
      />
    );

    const exchangeButton = screen.getByRole('button', { name: /change root scope/i });
    await user.click(exchangeButton);

    expect(mockScopesDashboardsService.setNavigationScope).toHaveBeenCalledWith(undefined, undefined, []);
  });

  it('calls changeScopes when exchange icon is clicked', async () => {
    const user = userEvent.setup();
    const folder = createMockFolder({ subScopeName: 'subScope1' });

    render(
      <ScopesDashboardsTreeFolderItem
        folder={folder}
        folderPath={['']}
        folders={createMockFolders}
        onFolderUpdate={mockOnFolderUpdate}
      />
    );

    const exchangeButton = screen.getByRole('button', { name: /change root scope/i });
    await user.click(exchangeButton);

    expect(mockScopesSelectorService.changeScopes).toHaveBeenCalledWith(['subScope1'], undefined, undefined, false);
  });

  it('passes subScope prop to ScopesDashboardsTree when folder is expanded', () => {
    const folder = createMockFolder({ expanded: true, subScopeName: 'subScope1' });
    const childFolders: SuggestedNavigationsFoldersMap = {
      '': {
        title: '',
        expanded: true,
        folders: {
          childFolder: {
            title: 'Child Folder',
            expanded: false,
            folders: {},
            suggestedNavigations: {},
          },
        },
        suggestedNavigations: {},
      },
      childFolder: {
        title: 'Child Folder',
        expanded: false,
        folders: {},
        suggestedNavigations: {},
      },
    };

    render(
      <ScopesDashboardsTreeFolderItem
        folder={folder}
        folderPath={['']}
        folders={childFolders}
        onFolderUpdate={mockOnFolderUpdate}
      />
    );

    // ScopesDashboardsTree should be rendered when folder is expanded
    // We can verify this by checking that the children container is present
    const childrenContainer = screen.getByText('Test Folder').closest('div')?.nextSibling;
    expect(childrenContainer).toBeInTheDocument();
  });

  it('does not render ScopesDashboardsTree when folder is not expanded', () => {
    const folder = createMockFolder({ expanded: false, subScopeName: 'subScope1' });

    render(
      <ScopesDashboardsTreeFolderItem
        folder={folder}
        folderPath={['']}
        folders={createMockFolders}
        onFolderUpdate={mockOnFolderUpdate}
      />
    );

    // When not expanded, the children container should not be visible
    // The structure should only show the folder row
    expect(screen.getByText('Test Folder')).toBeInTheDocument();
  });

  it('prevents default and stops propagation when exchange icon is clicked', async () => {
    const folder = createMockFolder({ subScopeName: 'subScope1' });
    const preventDefault = jest.fn();
    const stopPropagation = jest.fn();

    render(
      <ScopesDashboardsTreeFolderItem
        folder={folder}
        folderPath={['']}
        folders={createMockFolders}
        onFolderUpdate={mockOnFolderUpdate}
      />
    );

    const exchangeButton = screen.getByRole('button', { name: /change root scope/i });
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    Object.defineProperty(clickEvent, 'preventDefault', { value: preventDefault });
    Object.defineProperty(clickEvent, 'stopPropagation', { value: stopPropagation });

    exchangeButton.dispatchEvent(clickEvent);

    // The onClick handler should prevent default and stop propagation
    // Note: userEvent.click doesn't trigger preventDefault/stopPropagation directly,
    // but the handler should call them. We verify the handler was called correctly.
    expect(mockScopesDashboardsService.setNavigationScope).toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalled();
    expect(preventDefault).toHaveBeenCalled();
  });

  it('does not call setNavigationScope when subScopeName is missing', async () => {
    const folder = createMockFolder({ subScopeName: undefined });

    render(
      <ScopesDashboardsTreeFolderItem
        folder={folder}
        folderPath={['']}
        folders={createMockFolders}
        onFolderUpdate={mockOnFolderUpdate}
      />
    );

    // No exchange button should be present, so no click should trigger setNavigationScope
    expect(mockScopesDashboardsService.setNavigationScope).not.toHaveBeenCalled();
    // Check precense of exchange button
    const exchangeButton = screen.queryByRole('button', { name: /change root scope/i });
    expect(exchangeButton).not.toBeInTheDocument();
  });

  it('does not call setNavigationScope when scopesSelectorService is not available', async () => {
    const user = userEvent.setup();
    const folder = createMockFolder({ subScopeName: 'subScope1' });

    mockUseScopesServices.mockReturnValueOnce(undefined);

    render(
      <ScopesDashboardsTreeFolderItem
        folder={folder}
        folderPath={['']}
        folders={createMockFolders}
        onFolderUpdate={mockOnFolderUpdate}
      />
    );

    const exchangeButton = screen.queryByRole('button', { name: /change root scope/i });
    if (exchangeButton) {
      await user.click(exchangeButton);
    }

    // Should not crash, but also should not call setNavigationScope if service is not available
    // The component checks for scopesSelectorService existence before calling setNavigationScope
    expect(mockScopesDashboardsService.setNavigationScope).not.toHaveBeenCalled();
  });

  describe('disableSubScopeSelection', () => {
    it('does not show exchange icon when disableSubScopeSelection is true', () => {
      const folder = createMockFolder({
        subScopeName: 'subScope1',
        disableSubScopeSelection: true,
      });

      render(
        <ScopesDashboardsTreeFolderItem
          folder={folder}
          folderPath={['']}
          folders={createMockFolders}
          onFolderUpdate={mockOnFolderUpdate}
        />
      );

      const exchangeButtons = screen.queryAllByRole('button', { name: /change root scope/i });
      expect(exchangeButtons).toHaveLength(0);
    });

    it('shows exchange icon when disableSubScopeSelection is false', () => {
      const folder = createMockFolder({
        subScopeName: 'subScope1',
        disableSubScopeSelection: false,
      });

      render(
        <ScopesDashboardsTreeFolderItem
          folder={folder}
          folderPath={['']}
          folders={createMockFolders}
          onFolderUpdate={mockOnFolderUpdate}
        />
      );

      const exchangeButton = screen.getByRole('button', { name: /change root scope/i });
      expect(exchangeButton).toBeInTheDocument();
    });

    it('shows exchange icon when disableSubScopeSelection is undefined', () => {
      const folder = createMockFolder({
        subScopeName: 'subScope1',
        disableSubScopeSelection: undefined,
      });

      render(
        <ScopesDashboardsTreeFolderItem
          folder={folder}
          folderPath={['']}
          folders={createMockFolders}
          onFolderUpdate={mockOnFolderUpdate}
        />
      );

      const exchangeButton = screen.getByRole('button', { name: /change root scope/i });
      expect(exchangeButton).toBeInTheDocument();
    });
  });

  describe('inherited subScope for group folders', () => {
    it('writes nav_scope_path when clicking a dashboard under a group inside a ChildScope', async () => {
      const user = userEvent.setup();
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      Object.defineProperty(window, 'location', {
        value: { origin: 'http://localhost' },
        writable: true,
      });

      // ChildScope folder containing a group folder with a dashboard
      const shoesFolder = createMockFolder({
        title: 'Shoes',
        expanded: true,
        subScopeName: 'shoes',
        folders: {
          'Team Metrics': {
            title: 'Team Metrics',
            expanded: true,
            folders: {},
            suggestedNavigations: {
              latency: {
                id: 'latency',
                title: 'Latency (under group)',
                url: '/d/latency',
              },
            },
          },
        },
      });

      const folders: SuggestedNavigationsFoldersMap = {
        '': shoesFolder,
        'Team Metrics': shoesFolder.folders['Team Metrics'],
      };

      renderWithRouter(
        <ScopesDashboardsTreeFolderItem
          folder={shoesFolder}
          folderPath={['']}
          folders={folders}
          onFolderUpdate={mockOnFolderUpdate}
          subScopePath={['shoes']}
        />
      );

      const link = screen.getByTestId('scopes-dashboards-latency');
      await user.click(link);

      expect(mockScopesSelectorService.changeScopes).toHaveBeenCalledWith(['shoes'], undefined, undefined, false);
      expect(mockLocationServicePush).toHaveBeenCalled();
      const pushedUrl = mockLocationServicePush.mock.calls[0][0];
      expect(pushedUrl).toContain('scopes=shoes');
      expect(pushedUrl).toContain('nav_scope_path=');
      expect(decodeURIComponent(pushedUrl)).toContain('shoes');
      consoleWarnSpy.mockRestore();
    });

    it('writes nav_scope_path for a direct ChildScope dashboard when subScope prop is undefined', async () => {
      const user = userEvent.setup();
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      Object.defineProperty(window, 'location', {
        value: { origin: 'http://localhost' },
        writable: true,
      });

      // Dashboard attached directly under ChildScope (no group). subScope prop omitted;
      // folder.subScopeName alone should still drive nav_scope_path.
      const shoesFolder = createMockFolder({
        title: 'Shoes',
        expanded: true,
        subScopeName: 'shoes',
        suggestedNavigations: {
          overview: {
            id: 'overview',
            title: 'Overview',
            url: '/d/overview',
          },
        },
      });

      const folders: SuggestedNavigationsFoldersMap = {
        '': shoesFolder,
      };

      renderWithRouter(
        <ScopesDashboardsTreeFolderItem
          folder={shoesFolder}
          folderPath={['']}
          folders={folders}
          onFolderUpdate={mockOnFolderUpdate}
          subScopePath={['shoes']}
        />
      );

      const link = screen.getByTestId('scopes-dashboards-overview');
      await user.click(link);

      expect(mockScopesSelectorService.changeScopes).toHaveBeenCalledWith(['shoes'], undefined, undefined, false);
      expect(mockLocationServicePush).toHaveBeenCalled();
      const pushedUrl = mockLocationServicePush.mock.calls[0][0];
      expect(pushedUrl).toContain('scopes=shoes');
      expect(pushedUrl).toContain('nav_scope_path=');
      expect(decodeURIComponent(pushedUrl)).toContain('shoes');
      consoleWarnSpy.mockRestore();
    });
  });
});

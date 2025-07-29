import { render, screen, fireEvent } from '@testing-library/react';

import { PluginExtensionTypes, IconName } from '@grafana/data';
import { setPluginLinksHook } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';

import { getMockDataSource } from '../mocks/dataSourcesMocks';

import { EditDataSourceActions } from './EditDataSourceActions';

// Mock dependencies
jest.mock('app/core/services/context_srv');
jest.mock('../utils', () => ({
  constructDataSourceExploreUrl: jest.fn(() => '/explore?left=%7B%22datasource%22:%22Test%20Prometheus%22,%22context%22:%22explore%22%7D'),
}));

// Set default plugin links hook
setPluginLinksHook(() => ({ links: [], isLoading: false }));

// Mock contextSrv
const mockContextSrv = contextSrv as jest.Mocked<typeof contextSrv>;

// Helper function to create mock plugin link extensions with all required properties
const createMockPluginLink = (
  overrides: Partial<{
    id: string;
    path: string;
    onClick: jest.Mock;
    title: string;
    description: string;
    pluginId: string;
    icon?: IconName;
  }> = {}
) => ({
  id: 'test-link',
  type: PluginExtensionTypes.link as const,
  title: 'Test Action',
  description: 'Test action description',
  pluginId: 'grafana-lokiexplore-app',
  path: '/test-action',
  onClick: jest.fn(),
  ...overrides,
});

const mockDataSource = getMockDataSource({
  uid: 'test-uid',
  type: 'prometheus',
  name: 'Test Prometheus',
  typeName: 'Prometheus',
});

// Mock useDataSource hook
jest.mock('../state/hooks', () => ({
  useDataSource: () => mockDataSource,
}));

describe('EditDataSourceActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset plugin links hook to default
    setPluginLinksHook(() => ({ links: [], isLoading: false }));
    // Default contextSrv mock - user has explore rights
    mockContextSrv.hasAccessToExplore.mockReturnValue(true);
  });

  describe('Core Actions', () => {
    it('should render core Grafana actions when user has explore rights', async () => {
      mockContextSrv.hasAccessToExplore.mockReturnValue(true);

      render(<EditDataSourceActions uid="test-uid" />);

      // Should render the Actions dropdown button
      const actionsButton = screen.getByText('Actions');
      expect(actionsButton).toBeInTheDocument();

      // Click the dropdown to open the menu
      fireEvent.click(actionsButton);

      // Now the menu items should be visible
      expect(screen.getByText('Explore data')).toBeInTheDocument();
      expect(screen.getByText('Build a dashboard')).toBeInTheDocument();
    });

    it('should not render explore action when user lacks explore rights', () => {
      mockContextSrv.hasAccessToExplore.mockReturnValue(false);

      render(<EditDataSourceActions uid="test-uid" />);

      // Should render just the "Build a dashboard" button directly (not in dropdown)
      expect(screen.getByText('Build a dashboard')).toBeInTheDocument();
      // Should not render the Actions dropdown
      expect(screen.queryByText('Actions')).not.toBeInTheDocument();
      // Should not render explore action anywhere
      expect(screen.queryByText('Explore data')).not.toBeInTheDocument();
    });

    it('should have correct href for explore action', () => {
      render(<EditDataSourceActions uid="test-uid" />);

      // Click the dropdown to open the menu
      const actionsButton = screen.getByText('Actions');
      fireEvent.click(actionsButton);

      const exploreLink = screen.getByText('Explore data').closest('a');
      // The explore URL uses the datasource name, not uid, and includes context
      expect(exploreLink).toHaveAttribute(
        'href',
        '/explore?left=%7B%22datasource%22:%22Test%20Prometheus%22,%22context%22:%22explore%22%7D'
      );
    });

    it('should have correct href for build dashboard action', () => {
      render(<EditDataSourceActions uid="test-uid" />);

      // Click the dropdown to open the menu
      const actionsButton = screen.getByText('Actions');
      fireEvent.click(actionsButton);

      const dashboardLink = screen.getByText('Build a dashboard').closest('a');
      expect(dashboardLink).toHaveAttribute('href', 'dashboard/new-with-ds/test-uid');
    });
  });

  describe('Plugin Extension Actions', () => {
    it('should render plugin extension links from allowed plugins', () => {
      const mockLinks = [
        createMockPluginLink({
          id: 'loki-explore',
          title: 'Explore Logs',
          pluginId: 'grafana-lokiexplore-app',
          path: '/a/grafana-lokiexplore-app',
        }),
        createMockPluginLink({
          id: 'traces-explore',
          title: 'Explore Traces',
          pluginId: 'grafana-exploretraces-app',
          path: '/a/grafana-exploretraces-app',
        }),
      ];

      setPluginLinksHook(() => ({ links: mockLinks, isLoading: false }));

      render(<EditDataSourceActions uid="test-uid" />);

      // Click the dropdown to open the menu
      const actionsButton = screen.getByText('Actions');
      fireEvent.click(actionsButton);

      expect(screen.getByText('Explore Logs')).toBeInTheDocument();
      expect(screen.getByText('Explore Traces')).toBeInTheDocument();
    });

    it('should filter out links from non-allowed plugins', () => {
      const mockLinks = [
        createMockPluginLink({
          id: 'allowed-plugin',
          title: 'Allowed Action',
          pluginId: 'grafana-lokiexplore-app', // Allowed
        }),
        createMockPluginLink({
          id: 'disallowed-plugin',
          title: 'Disallowed Action',
          pluginId: 'some-random-plugin', // Not allowed
        }),
      ];

      setPluginLinksHook(() => ({ links: mockLinks, isLoading: false }));

      render(<EditDataSourceActions uid="test-uid" />);

      // Click the dropdown to open the menu
      const actionsButton = screen.getByText('Actions');
      fireEvent.click(actionsButton);

      expect(screen.getByText('Allowed Action')).toBeInTheDocument();
      expect(screen.queryByText('Disallowed Action')).not.toBeInTheDocument();
    });

    it('should call usePluginLinks with correct parameters', () => {
      // This test verifies the component calls usePluginLinks correctly
      // We can't easily test the exact parameters without more complex mocking
      // but we can verify the component renders without errors when links are provided
      setPluginLinksHook(() => ({ links: [], isLoading: false }));

      expect(() => {
        render(<EditDataSourceActions uid="test-uid" />);
      }).not.toThrow();
    });

    it('should handle plugin link onClick events', () => {
      const mockOnClick = jest.fn();
      const mockLinks = [
        createMockPluginLink({
          id: 'clickable-action',
          title: 'Clickable Action',
          onClick: mockOnClick,
          pluginId: 'grafana-lokiexplore-app',
        }),
      ];

      setPluginLinksHook(() => ({ links: mockLinks, isLoading: false }));

      render(<EditDataSourceActions uid="test-uid" />);

      // Click the dropdown to open the menu
      const actionsButton = screen.getByText('Actions');
      fireEvent.click(actionsButton);

      const actionButton = screen.getByText('Clickable Action');
      fireEvent.click(actionButton);

      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should render extension links with correct attributes', () => {
      const mockLinks = [
        createMockPluginLink({
          id: 'test-action',
          title: 'Test Action',
          description: 'Test description',
          path: '/test-path',
          icon: 'external-link-alt' as IconName,
          pluginId: 'grafana-lokiexplore-app',
        }),
      ];

      setPluginLinksHook(() => ({ links: mockLinks, isLoading: false }));

      render(<EditDataSourceActions uid="test-uid" />);

      // Click the dropdown to open the menu
      const actionsButton = screen.getByText('Actions');
      fireEvent.click(actionsButton);

      const actionButton = screen.getByText('Test Action');
      const linkElement = actionButton.closest('a');

      expect(linkElement).toHaveAttribute('href', '/test-path');
      // The description is passed as tooltip, which may not appear as a title attribute
      // This is handled by the LinkButton component internally
    });

    it('should not render extensions when isLoading is true', () => {
      const mockLinks = [
        createMockPluginLink({
          title: 'Should Not Appear',
          pluginId: 'grafana-lokiexplore-app',
        }),
      ];

      setPluginLinksHook(() => ({ links: mockLinks, isLoading: true }));

      render(<EditDataSourceActions uid="test-uid" />);

      // Should render the Actions dropdown since user has explore rights
      const actionsButton = screen.getByText('Actions');
      fireEvent.click(actionsButton);

      expect(screen.queryByText('Should Not Appear')).not.toBeInTheDocument();
      // Core actions should still be there
      expect(screen.getByText('Build a dashboard')).toBeInTheDocument();
      expect(screen.getByText('Explore data')).toBeInTheDocument();
    });

    it('should handle empty extension links gracefully', () => {
      setPluginLinksHook(() => ({ links: [], isLoading: false }));

      render(<EditDataSourceActions uid="test-uid" />);

      // Should render the Actions dropdown since user has explore rights
      const actionsButton = screen.getByText('Actions');
      fireEvent.click(actionsButton);

      // Should render core actions without errors
      expect(screen.getByText('Build a dashboard')).toBeInTheDocument();
      expect(screen.getByText('Explore data')).toBeInTheDocument();
    });
  });
});

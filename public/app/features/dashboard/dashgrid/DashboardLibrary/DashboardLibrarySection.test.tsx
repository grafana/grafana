import { screen, waitFor, within } from '@testing-library/react';
import { render } from 'test/test-utils';

import { locationService } from '@grafana/runtime';

import { DashboardLibrarySection } from './DashboardLibrarySection';
import { fetchProvisionedDashboards } from './api/dashboardLibraryApi';
import { DashboardLibraryInteractions } from './interactions';
import { createMockPluginDashboard } from './utils/test-utils';

jest.mock('./api/dashboardLibraryApi', () => ({
  fetchProvisionedDashboards: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getInstanceSettings: jest.fn((uid?: string) => {
      if (uid) {
        return {
          uid,
          name: `DataSource ${uid}`,
          type: 'test-datasource',
        };
      }
      return null;
    }),
  }),
  locationService: {
    push: jest.fn(),
    getHistory: jest.fn(() => ({
      listen: jest.fn(() => jest.fn()),
    })),
  },
}));

jest.mock('./interactions', () => ({
  ...jest.requireActual('./interactions'),
  DashboardLibraryInteractions: {
    loaded: jest.fn(),
    itemClicked: jest.fn(),
  },
}));

jest.mock('./DashboardCard', () => {
  const DashboardCardComponent = ({ title, onClick }: { title: string; onClick: () => void }) => (
    <div data-testid={`dashboard-card-${title}`} onClick={onClick}>
      {title}
    </div>
  );

  const DashboardCardSkeleton = () => <div data-testid="dashboard-card-skeleton">Skeleton</div>;

  return {
    DashboardCard: Object.assign(DashboardCardComponent, {
      Skeleton: DashboardCardSkeleton,
    }),
  };
});

const mockFetchProvisionedDashboards = fetchProvisionedDashboards as jest.MockedFunction<
  typeof fetchProvisionedDashboards
>;
const mockLocationServicePush = locationService.push as jest.MockedFunction<typeof locationService.push>;
const mockDashboardLibraryInteractionsLoaded = DashboardLibraryInteractions.loaded as jest.MockedFunction<
  typeof DashboardLibraryInteractions.loaded
>;
const mockDashboardLibraryInteractionsItemClicked = DashboardLibraryInteractions.itemClicked as jest.MockedFunction<
  typeof DashboardLibraryInteractions.itemClicked
>;

describe('DashboardLibrarySection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render dashboards when they are available', async () => {
    const dashboards = [
      createMockPluginDashboard({ title: 'Dashboard 1', uid: 'uid-1' }),
      createMockPluginDashboard({ title: 'Dashboard 2', uid: 'uid-2' }),
    ];

    mockFetchProvisionedDashboards.mockResolvedValue(dashboards);

    render(<DashboardLibrarySection />, {
      historyOptions: {
        initialEntries: ['/test?dashboardLibraryDatasourceUid=test-uid'],
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-card-Dashboard 1')).toBeInTheDocument();
      expect(screen.getByTestId('dashboard-card-Dashboard 2')).toBeInTheDocument();
    });
  });

  it('should show empty state when there are no dashboards', async () => {
    mockFetchProvisionedDashboards.mockResolvedValue([]);

    render(<DashboardLibrarySection />, {
      historyOptions: {
        initialEntries: ['/test?dashboardLibraryDatasourceUid=test-uid'],
      },
    });

    await waitFor(() => {
      expect(screen.getByText('No test-datasource provisioned dashboards found')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Provisioned dashboards are provided by data source plugins. You can find more plugins on Grafana.com.'
        )
      ).toBeInTheDocument();
      const browseButton = screen.getByRole('button', { name: 'Browse plugins' });
      expect(browseButton).toBeInTheDocument();
    });
  });

  it('should show empty state without datasource type when datasourceUid is not provided', async () => {
    mockFetchProvisionedDashboards.mockResolvedValue([]);

    render(<DashboardLibrarySection />, {
      historyOptions: {
        initialEntries: ['/test'],
      },
    });

    await waitFor(() => {
      expect(screen.getByText('No provisioned dashboards found')).toBeInTheDocument();
    });
  });

  it('should render pagination when there are more than 9 dashboards', async () => {
    const dashboards = Array.from({ length: 18 }, (_, i) =>
      createMockPluginDashboard({ title: `Dashboard ${i + 1}`, uid: `uid-${i + 1}` })
    );

    mockFetchProvisionedDashboards.mockResolvedValue(dashboards);

    render(<DashboardLibrarySection />, {
      historyOptions: {
        initialEntries: ['/test?dashboardLibraryDatasourceUid=test-uid'],
      },
    });

    await waitFor(() => {
      const pagination = screen.getByRole('navigation');
      expect(pagination).toBeInTheDocument();
      expect(within(pagination).getByText('1')).toBeInTheDocument();
      expect(within(pagination).getByText('2')).toBeInTheDocument();
    });
  });

  it('should not render pagination when there are 9 or fewer dashboards', async () => {
    const dashboards = Array.from({ length: 9 }, (_, i) =>
      createMockPluginDashboard({ title: `Dashboard ${i + 1}`, uid: `uid-${i + 1}` })
    );

    mockFetchProvisionedDashboards.mockResolvedValue(dashboards);

    render(<DashboardLibrarySection />, {
      historyOptions: {
        initialEntries: ['/test?dashboardLibraryDatasourceUid=test-uid'],
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-card-Dashboard 1')).toBeInTheDocument();
    });

    const pagination = screen.queryByRole('navigation');
    expect(pagination).not.toBeInTheDocument();
  });

  it('should navigate to template route when clicking on a dashboard', async () => {
    const dashboard = createMockPluginDashboard({
      title: 'Test Dashboard',
      uid: 'test-uid-123',
      pluginId: 'test-plugin',
      path: 'test/path.json',
    });

    mockFetchProvisionedDashboards.mockResolvedValue([dashboard]);

    render(<DashboardLibrarySection />, {
      historyOptions: {
        initialEntries: ['/test?dashboardLibraryDatasourceUid=test-uid'],
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-card-Test Dashboard')).toBeInTheDocument();
    });

    const dashboardCard = screen.getByTestId('dashboard-card-Test Dashboard');
    dashboardCard.click();

    await waitFor(() => {
      expect(mockLocationServicePush).toHaveBeenCalled();
      const callArgs = mockLocationServicePush.mock.calls[0][0];
      expect(callArgs).toContain('/dashboard/template');
      expect(callArgs).toContain('datasource=test-uid');

      expect(callArgs).toContain('title=Test+Dashboard');
      expect(callArgs).toContain('pluginId=test-plugin');
      expect(callArgs).toContain('path=test%2Fpath.json');
      expect(callArgs).toContain('libraryItemId=test-uid-123');
    });
  });

  it('should track analytics when dashboards are loaded', async () => {
    const dashboards = [
      createMockPluginDashboard({ title: 'Dashboard 1', uid: 'uid-1' }),
      createMockPluginDashboard({ title: 'Dashboard 2', uid: 'uid-2' }),
    ];

    mockFetchProvisionedDashboards.mockResolvedValue(dashboards);

    render(<DashboardLibrarySection />, {
      historyOptions: {
        initialEntries: ['/test?dashboardLibraryDatasourceUid=test-uid'],
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-card-Dashboard 1')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(mockDashboardLibraryInteractionsLoaded).toHaveBeenCalledWith({
        numberOfItems: 2,
        contentKinds: ['datasource_dashboard'],
        datasourceTypes: ['test-datasource'],
        sourceEntryPoint: 'datasource_page',
        eventLocation: 'suggested_dashboards_modal_provisioned_tab',
      });
    });
  });

  it('should track analytics when a dashboard is clicked', async () => {
    const dashboard = createMockPluginDashboard({
      title: 'Test Dashboard',
      uid: 'test-uid-123',
      pluginId: 'test-plugin',
    });

    mockFetchProvisionedDashboards.mockResolvedValue([dashboard]);

    render(<DashboardLibrarySection />, {
      historyOptions: {
        initialEntries: ['/test?dashboardLibraryDatasourceUid=test-uid'],
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-card-Test Dashboard')).toBeInTheDocument();
    });

    const dashboardCard = screen.getByTestId('dashboard-card-Test Dashboard');
    dashboardCard.click();

    await waitFor(() => {
      expect(mockDashboardLibraryInteractionsItemClicked).toHaveBeenCalledWith({
        contentKind: 'datasource_dashboard',
        datasourceTypes: ['test-plugin'],
        libraryItemId: 'test-uid-123',
        libraryItemTitle: 'Test Dashboard',
        sourceEntryPoint: 'datasource_page',
        eventLocation: 'suggested_dashboards_modal_provisioned_tab',
        discoveryMethod: 'browse',
      });
    });
  });
});

import { screen, waitFor } from '@testing-library/react';
import { render } from 'test/test-utils';

import { SuggestedDashboards } from './SuggestedDashboards';
import { fetchCommunityDashboards, fetchProvisionedDashboards } from './api/dashboardLibraryApi';
import { createMockGnetDashboard, createMockPluginDashboard } from './utils/test-utils';

jest.mock('./api/dashboardLibraryApi', () => ({
  fetchProvisionedDashboards: jest.fn(),
  fetchCommunityDashboards: jest.fn(),
}));

jest.mock('./utils/communityDashboardHelpers', () => ({
  ...jest.requireActual('./utils/communityDashboardHelpers'),
  onUseCommunityDashboard: jest.fn(),
}));

jest.mock('./SuggestedDashboardsModal', () => ({
  SuggestedDashboardsModal: () => <div data-testid="suggested-dashboards-modal">Modal</div>,
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
}));

jest.mock('./interactions', () => ({
  ...jest.requireActual('./interactions'),
  DashboardLibraryInteractions: {
    loaded: jest.fn(),
    itemClicked: jest.fn(),
  },
}));

const mockFetchProvisionedDashboards = fetchProvisionedDashboards as jest.MockedFunction<
  typeof fetchProvisionedDashboards
>;
const mockFetchCommunityDashboards = fetchCommunityDashboards as jest.MockedFunction<typeof fetchCommunityDashboards>;

describe('SuggestedDashboards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render when there are dashboards', async () => {
    mockFetchProvisionedDashboards.mockResolvedValue([createMockPluginDashboard()]);
    mockFetchCommunityDashboards.mockResolvedValue({
      page: 1,
      pages: 1,
      items: [createMockGnetDashboard()],
    });

    render(<SuggestedDashboards datasourceUid="test-uid" />);

    await waitFor(() => {
      expect(screen.getByTestId('suggested-dashboards')).toBeInTheDocument();
    });
  });

  it('should not render when there are no dashboards', async () => {
    mockFetchProvisionedDashboards.mockResolvedValue([]);
    mockFetchCommunityDashboards.mockResolvedValue({
      page: 1,
      pages: 1,
      items: [],
    });

    render(<SuggestedDashboards datasourceUid="test-uid" />);

    await waitFor(() => {
      expect(screen.queryByTestId('suggested-dashboards')).not.toBeInTheDocument();
    });
  });

  it('should render provisioned dashboard cards', async () => {
    const provisionedDashboard = createMockPluginDashboard({ title: 'Provisioned Dashboard 1' });
    mockFetchProvisionedDashboards.mockResolvedValue([provisionedDashboard]);
    mockFetchCommunityDashboards.mockResolvedValue({
      page: 1,
      pages: 1,
      items: [],
    });

    render(<SuggestedDashboards datasourceUid="test-uid" />);

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-card-Provisioned Dashboard 1')).toBeInTheDocument();
    });
  });

  it('should render community dashboard cards', async () => {
    const communityDashboard = createMockGnetDashboard({ name: 'Community Dashboard 1' });
    mockFetchProvisionedDashboards.mockResolvedValue([]);
    mockFetchCommunityDashboards.mockResolvedValue({
      page: 1,
      pages: 1,
      items: [communityDashboard],
    });

    render(<SuggestedDashboards datasourceUid="test-uid" />);

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-card-Community Dashboard 1')).toBeInTheDocument();
    });
  });

  it('should show "View all" button when hasMoreDashboards is true', async () => {
    mockFetchProvisionedDashboards.mockResolvedValue([
      createMockPluginDashboard(),
      createMockPluginDashboard({ title: 'Provisioned Dashboard 2' }),
    ]);
    mockFetchCommunityDashboards.mockResolvedValue({
      page: 1,
      pages: 1,
      items: [],
    });

    render(<SuggestedDashboards datasourceUid="test-uid" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'View all' })).toBeInTheDocument();
    });
  });

  it('should not show "View all" button when hasMoreDashboards is false', async () => {
    mockFetchProvisionedDashboards.mockResolvedValue([createMockPluginDashboard()]);
    mockFetchCommunityDashboards.mockResolvedValue({
      page: 1,
      pages: 1,
      items: [createMockGnetDashboard()],
    });

    render(<SuggestedDashboards datasourceUid="test-uid" />);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'View all' })).not.toBeInTheDocument();
    });
  });

  it('should render title and subtitle with datasource type when datasourceUid is provided', async () => {
    mockFetchProvisionedDashboards.mockResolvedValue([createMockPluginDashboard()]);
    mockFetchCommunityDashboards.mockResolvedValue({
      page: 1,
      pages: 1,
      items: [],
    });

    render(<SuggestedDashboards datasourceUid="test-uid" />);

    await waitFor(() => {
      expect(
        screen.getByText('Build a dashboard using suggested options for your test-datasource data source')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Browse and select from data-source provided or community dashboards')
      ).toBeInTheDocument();
    });
  });
});

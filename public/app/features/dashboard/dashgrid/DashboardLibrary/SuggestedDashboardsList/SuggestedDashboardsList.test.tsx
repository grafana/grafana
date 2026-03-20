import { act, screen, waitFor } from '@testing-library/react';
import { render } from 'test/test-utils';

import { locationService } from '@grafana/runtime';

import { TrackingProvider } from '../TrackingContext';
import { SuggestedDashboardsList } from '../SuggestedDashboardsList/SuggestedDashboardsList';
import { fetchCommunityDashboards } from '../api/dashboardLibraryApi';
import { EVENT_LOCATIONS, SOURCE_ENTRY_POINTS } from '../constants';
import { GnetDashboard } from '../types';
import { onUseCommunityDashboard } from '../utils/communityDashboardHelpers';
import { createMockGnetDashboard, createMockPluginDashboard } from '../utils/test-utils';

jest.mock('../api/dashboardLibraryApi', () => ({
  fetchCommunityDashboards: jest.fn(),
}));

jest.mock('../api/compatibilityApi', () => ({
  checkDashboardCompatibility: jest.fn(),
}));

jest.mock('../utils/communityDashboardHelpers', () => ({
  ...jest.requireActual('../utils/communityDashboardHelpers'),
  onUseCommunityDashboard: jest.fn(),
  interpolateDashboardForCompatibilityCheck: jest.fn(),
}));

jest.mock('../interactions', () => ({
  ...jest.requireActual('../interactions'),
  DashboardLibraryInteractions: {
    loaded: jest.fn(),
    searchPerformed: jest.fn(),
    itemClicked: jest.fn(),
    compatibilityCheckTriggered: jest.fn(),
    compatibilityCheckCompleted: jest.fn(),
  },
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getInstanceSettings: jest.fn((uid: string) => ({
      uid,
      name: `DataSource ${uid}`,
      type: 'prometheus',
    })),
  }),
  locationService: {
    push: jest.fn(),
    getHistory: jest.fn(() => ({
      listen: jest.fn(() => jest.fn()),
    })),
  },
}));

const mockFetchCommunityDashboards = fetchCommunityDashboards as jest.MockedFunction<typeof fetchCommunityDashboards>;

// Helper: creates community dashboards that mirror what the API mock returns
const communityDashboard1 = createMockGnetDashboard({ id: 1, name: 'Community Dashboard 1' });
const communityDashboard2 = createMockGnetDashboard({ id: 2, name: 'Community Dashboard 2' });

const defaultProps = {
  provisionedDashboards: [] as Array<ReturnType<typeof createMockPluginDashboard>>,
  communityDashboards: [] as GnetDashboard[],
  communityTotalPages: 1,
  datasourceUid: 'test-ds-uid',
  datasourceType: 'prometheus',
  isDashboardsLoading: false,
  onShowMapping: jest.fn(),
  onDismiss: jest.fn(),
};

/**
 * Render and wait for all async effects to settle (initial page resolution, community fetches).
 */
const trackingValue = {
  sourceEntryPoint: SOURCE_ENTRY_POINTS.DATASOURCE_PAGE_BUILD_BUTTON,
  eventLocation: EVENT_LOCATIONS.MODAL_VIEW,
} as const;

async function setup(overrides: Partial<typeof defaultProps> = {}) {
  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <TrackingProvider value={trackingValue}>
        <SuggestedDashboardsList {...defaultProps} {...overrides} />
      </TrackingProvider>
    );
  });
  return result!;
}

describe('SuggestedDashboardsList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: API returns the same community dashboards as the prop seed
    mockFetchCommunityDashboards.mockResolvedValue({
      page: 1,
      pages: 1,
      items: [communityDashboard1, communityDashboard2],
    });
  });

  it('should render provisioned dashboards with "Data source provided" badge', async () => {
    const provisioned = [
      createMockPluginDashboard({ title: 'Provisioned 1', uid: 'p1' }),
      createMockPluginDashboard({ title: 'Provisioned 2', uid: 'p2' }),
    ];

    await setup({ provisionedDashboards: provisioned });

    expect(screen.getByText('Provisioned 1')).toBeInTheDocument();
    expect(screen.getByText('Provisioned 2')).toBeInTheDocument();
    expect(screen.getAllByText('Data source provided')).toHaveLength(2);
  });

  it('should render community dashboards with "Community" badge', async () => {
    mockFetchCommunityDashboards.mockResolvedValue({
      page: 1,
      pages: 1,
      items: [communityDashboard1],
    });

    await setup({
      communityDashboards: [communityDashboard1],
    });

    await waitFor(() => {
      expect(screen.getByText('Community Dashboard 1')).toBeInTheDocument();
    });

    expect(screen.getByText('Community')).toBeInTheDocument();
  });

  it('should show provisioned dashboards before community dashboards', async () => {
    const provisioned = [createMockPluginDashboard({ title: 'Provisioned First', uid: 'p1' })];

    mockFetchCommunityDashboards.mockResolvedValue({
      page: 1,
      pages: 1,
      items: [communityDashboard1],
    });

    await setup({
      provisionedDashboards: provisioned,
      communityDashboards: [communityDashboard1],
    });

    await waitFor(() => {
      expect(screen.getByText('Provisioned First')).toBeInTheDocument();
      expect(screen.getByText('Community Dashboard 1')).toBeInTheDocument();
    });

    expect(screen.getByText('Data source provided')).toBeInTheDocument();
    expect(screen.getByText('Community')).toBeInTheDocument();
  });

  it('should show loading skeletons when isDashboardsLoading is true', async () => {
    await setup({ isDashboardsLoading: true });

    // Should show skeleton cards (via react-loading-skeleton)
    const skeletons = document.querySelectorAll('[class*="skeleton"], [class*="Skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render "Create a dashboard from scratch instead" link', async () => {
    await setup();

    expect(screen.getByText('Create a dashboard from scratch instead')).toBeInTheDocument();
  });

  it('should render search input', async () => {
    await setup();

    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('should navigate to template route when clicking on a provisioned dashboard', async () => {
    const dashboard = createMockPluginDashboard({
      title: 'Click Me',
      uid: 'click-uid',
      pluginId: 'test-plugin',
      path: 'test/path.json',
    });

    const { user } = await setup({ provisionedDashboards: [dashboard] });

    expect(screen.getByText('Click Me')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'View dashboard: Click Me' }));

    await waitFor(() => {
      expect(locationService.push).toHaveBeenCalled();
      const callArgs = (locationService.push as jest.Mock).mock.calls[0][0];
      expect(callArgs).toContain('/dashboard/template');
    });
  });

  it('should call onUseCommunityDashboard when clicking on a community dashboard', async () => {
    mockFetchCommunityDashboards.mockResolvedValue({
      page: 1,
      pages: 1,
      items: [communityDashboard1],
    });

    const { user } = await setup({
      communityDashboards: [communityDashboard1],
    });

    await waitFor(() => {
      expect(screen.getByText('Community Dashboard 1')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'View dashboard: Community Dashboard 1' }));

    await waitFor(() => {
      expect(onUseCommunityDashboard).toHaveBeenCalledWith(
        expect.objectContaining({
          dashboard: expect.objectContaining({ id: 1 }),
          datasourceUid: 'test-ds-uid',
        })
      );
    });
  });

  it('should show description text', async () => {
    await setup();

    expect(screen.getByText('Browse and select from data-source provided or community dashboards')).toBeInTheDocument();
  });
});

import { screen, waitFor } from '@testing-library/react';
import React from 'react';
import { render, testWithFeatureToggles } from 'test/test-utils';

import { DashboardJson } from 'app/features/manage-dashboards/types';

import { CommunityDashboardSection } from './CommunityDashboardSection';
import { checkDashboardCompatibility, CompatibilityCheckResult } from './api/compatibilityApi';
import { fetchCommunityDashboards } from './api/dashboardLibraryApi';
import { DashboardLibraryInteractions } from './interactions';
import { GnetDashboard } from './types';
import { onUseCommunityDashboard, interpolateDashboardForCompatibilityCheck } from './utils/communityDashboardHelpers';

jest.mock('./api/dashboardLibraryApi', () => ({
  fetchCommunityDashboards: jest.fn(),
}));

jest.mock('./api/compatibilityApi', () => ({
  checkDashboardCompatibility: jest.fn(),
}));

jest.mock('./utils/communityDashboardHelpers', () => ({
  ...jest.requireActual('./utils/communityDashboardHelpers'),
  onUseCommunityDashboard: jest.fn(),
  interpolateDashboardForCompatibilityCheck: jest.fn(),
}));

jest.mock('./interactions', () => ({
  ...jest.requireActual('./interactions'),
  DashboardLibraryInteractions: {
    loaded: jest.fn(),
    searchPerformed: jest.fn(),
    itemClicked: jest.fn(),
    compatibilityCheckTriggered: jest.fn(),
    compatibilityCheckCompleted: jest.fn(),
  },
}));

// Track the datasource type for mocking
let mockDatasourceType = 'prometheus';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getInstanceSettings: jest.fn((uid: string) => ({
      uid,
      name: `DataSource ${uid}`,
      type: mockDatasourceType,
    })),
  }),
}));

const mockFetchCommunityDashboards = fetchCommunityDashboards as jest.MockedFunction<typeof fetchCommunityDashboards>;
const mockOnUseCommunityDashboard = onUseCommunityDashboard as jest.MockedFunction<typeof onUseCommunityDashboard>;
const mockInterpolateDashboard = interpolateDashboardForCompatibilityCheck as jest.MockedFunction<
  typeof interpolateDashboardForCompatibilityCheck
>;
const mockCheckCompatibility = checkDashboardCompatibility as jest.MockedFunction<typeof checkDashboardCompatibility>;

const createMockGnetDashboard = (overrides: Partial<GnetDashboard> = {}): GnetDashboard => ({
  id: 1,
  name: 'Test Dashboard',
  description: 'Test Description',
  downloads: 2000,
  datasource: 'Prometheus',
  slug: 'test-dashboard',
  ...overrides,
});

/**
 * Creates a mock DashboardJson object for testing.
 * Only includes the minimal required fields since `checkDashboardCompatibility` is mocked
 * and doesn't actually process the dashboard structure.
 */
const createMockDashboardJson = (overrides: Partial<DashboardJson> = {}): DashboardJson =>
  ({
    title: 'Test Dashboard',
    schemaVersion: 38,
    panels: [],
    ...overrides,
  }) as DashboardJson;

const createMockCompatibilityResult = (
  overrides: Partial<CompatibilityCheckResult> = {}
): CompatibilityCheckResult => ({
  compatibilityScore: 0.85,
  datasourceResults: [
    {
      uid: 'test-ds',
      type: 'prometheus',
      name: 'Test Prometheus',
      totalQueries: 10,
      checkedQueries: 10,
      totalMetrics: 20,
      foundMetrics: 17,
      missingMetrics: ['missing_metric_1', 'missing_metric_2', 'missing_metric_3'],
      compatibilityScore: 0.85,
      queryBreakdown: [],
    },
  ],
  ...overrides,
});

const setup = async (
  props: Partial<React.ComponentProps<typeof CommunityDashboardSection>> = {},
  successScenario = true,
  datasourceUid = 'test-datasource-uid'
) => {
  const renderResult = render(
    <CommunityDashboardSection onShowMapping={jest.fn()} datasourceType={mockDatasourceType} {...props} />,
    {
      historyOptions: {
        initialEntries: [`/test?dashboardLibraryDatasourceUid=${datasourceUid}`],
      },
    }
  );

  if (successScenario) {
    await waitFor(() => {
      expect(screen.getByText('Test Dashboard')).toBeInTheDocument();
    });
  }

  return renderResult;
};

describe('CommunityDashboardSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDatasourceType = 'prometheus';
  });

  it('should render', async () => {
    mockFetchCommunityDashboards.mockResolvedValue({
      page: 1,
      pages: 5,
      items: [
        createMockGnetDashboard(),
        createMockGnetDashboard({ id: 2, name: 'Test Dashboard 2' }),
        createMockGnetDashboard({ id: 3, name: 'Test Dashboard 3' }),
      ],
    });

    // Mock compatibility check to prevent auto-check errors
    mockInterpolateDashboard.mockResolvedValue(createMockDashboardJson());
    mockCheckCompatibility.mockResolvedValue(createMockCompatibilityResult());

    await setup();

    await waitFor(() => {
      expect(screen.getByText('Test Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Test Dashboard 2')).toBeInTheDocument();
      expect(screen.getByText('Test Dashboard 3')).toBeInTheDocument();
    });
  });

  it('should show error when fetching a specific community dashboard after clicking use dashboard button fails', async () => {
    mockFetchCommunityDashboards.mockResolvedValue({
      page: 1,
      pages: 5,
      items: [createMockGnetDashboard()],
    });

    // Mock compatibility check to prevent auto-check errors
    mockInterpolateDashboard.mockResolvedValue(createMockDashboardJson());
    mockCheckCompatibility.mockResolvedValue(createMockCompatibilityResult());

    mockOnUseCommunityDashboard.mockRejectedValue(new Error('Failed to use community dashboard'));

    const { user } = await setup();
    await waitFor(() => {
      expect(screen.getByText('Test Dashboard')).toBeInTheDocument();
    });

    const useDashboardButton = screen.getByRole('button', { name: 'Use dashboard' });
    await user.click(useDashboardButton);

    await waitFor(() => {
      expect(screen.getByText('Error loading community dashboard')).toBeInTheDocument();
    });
  });

  it('should show error when fetching community dashboards list fails', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    mockFetchCommunityDashboards.mockRejectedValue(new Error('Failed to fetch community dashboards'));

    await setup(undefined, false);

    await waitFor(() => {
      expect(screen.getByText('Error loading community dashboards')).toBeInTheDocument();
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading community dashboards', expect.any(Error));
    consoleErrorSpy.mockRestore();
  });

  describe('Compatibility Badge Feature', () => {
    testWithFeatureToggles({ enable: ['dashboardValidatorApp'] });

    it('should show "Check" button when datasource type is prometheus', async () => {
      mockDatasourceType = 'prometheus';
      mockFetchCommunityDashboards.mockResolvedValue({
        page: 1,
        pages: 5,
        items: [createMockGnetDashboard()],
      });

      // Mock the auto-check to prevent it from running
      mockInterpolateDashboard.mockResolvedValue(createMockDashboardJson());
      mockCheckCompatibility.mockResolvedValue(createMockCompatibilityResult());

      await setup();

      // Wait for the loading state to show and then complete
      await waitFor(() => {
        // Either we see the Check button (if auto-check hasn't completed) or the success badge
        const checkButtons = screen.queryAllByRole('button', { name: 'Check' });
        const successBadges = screen.queryAllByTestId('compatibility-badge-success');
        const loadingBadges = screen.queryAllByTestId('compatibility-badge-loading');
        expect(checkButtons.length + successBadges.length + loadingBadges.length).toBeGreaterThan(0);
      });
    });

    it('should hide compatibility badge when datasource type is not prometheus', async () => {
      mockDatasourceType = 'influxdb';
      mockFetchCommunityDashboards.mockResolvedValue({
        page: 1,
        pages: 5,
        items: [createMockGnetDashboard()],
      });

      await setup();

      await waitFor(() => {
        expect(screen.getByText('Test Dashboard')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: 'Check' })).not.toBeInTheDocument();
      expect(screen.queryByTestId('compatibility-badge-loading')).not.toBeInTheDocument();
    });

    it('should hide compatibility badge when no datasourceUid in URL', async () => {
      mockDatasourceType = 'prometheus';
      mockFetchCommunityDashboards.mockResolvedValue({
        page: 1,
        pages: 5,
        items: [createMockGnetDashboard()],
      });

      // Render without datasourceUid in URL
      render(<CommunityDashboardSection onShowMapping={jest.fn()} datasourceType="prometheus" />, {
        historyOptions: {
          initialEntries: ['/test'],
        },
      });

      // Wait for component to finish initial rendering
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Check' })).not.toBeInTheDocument();
      });
    });

    it('should auto-trigger compatibility check on initial load for prometheus', async () => {
      mockDatasourceType = 'prometheus';
      mockFetchCommunityDashboards.mockResolvedValue({
        page: 1,
        pages: 5,
        items: [createMockGnetDashboard()],
      });

      mockInterpolateDashboard.mockResolvedValue(createMockDashboardJson({ title: 'Interpolated' }));
      mockCheckCompatibility.mockResolvedValue(createMockCompatibilityResult());

      await setup();

      // Wait for auto-check to be triggered
      await waitFor(() => {
        expect(mockInterpolateDashboard).toHaveBeenCalledWith(1, 'test-datasource-uid');
      });

      await waitFor(() => {
        expect(mockCheckCompatibility).toHaveBeenCalled();
      });
    });

    it('should track analytics when compatibility check is triggered', async () => {
      mockDatasourceType = 'prometheus';
      mockFetchCommunityDashboards.mockResolvedValue({
        page: 1,
        pages: 5,
        items: [createMockGnetDashboard()],
      });

      mockInterpolateDashboard.mockResolvedValue(createMockDashboardJson({ title: 'Interpolated' }));
      mockCheckCompatibility.mockResolvedValue(createMockCompatibilityResult());

      await setup();

      await waitFor(() => {
        expect(DashboardLibraryInteractions.compatibilityCheckTriggered).toHaveBeenCalledWith(
          expect.objectContaining({
            dashboardId: '1',
            dashboardTitle: 'Test Dashboard',
            datasourceType: 'prometheus',
            triggerMethod: 'auto_initial_load',
          })
        );
      });
    });

    it('should track analytics when compatibility check completes', async () => {
      mockDatasourceType = 'prometheus';
      mockFetchCommunityDashboards.mockResolvedValue({
        page: 1,
        pages: 5,
        items: [createMockGnetDashboard()],
      });

      mockInterpolateDashboard.mockResolvedValue(createMockDashboardJson({ title: 'Interpolated' }));
      mockCheckCompatibility.mockResolvedValue(createMockCompatibilityResult());

      await setup();

      await waitFor(() => {
        expect(DashboardLibraryInteractions.compatibilityCheckCompleted).toHaveBeenCalledWith(
          expect.objectContaining({
            dashboardId: '1',
            dashboardTitle: 'Test Dashboard',
            datasourceType: 'prometheus',
            score: 85,
            metricsFound: 17,
            metricsTotal: 20,
            triggerMethod: 'auto_initial_load',
          })
        );
      });
    });

    it('should show success badge after compatibility check completes', async () => {
      mockDatasourceType = 'prometheus';
      mockFetchCommunityDashboards.mockResolvedValue({
        page: 1,
        pages: 5,
        items: [createMockGnetDashboard()],
      });

      mockInterpolateDashboard.mockResolvedValue(createMockDashboardJson({ title: 'Interpolated' }));
      mockCheckCompatibility.mockResolvedValue(createMockCompatibilityResult());

      await setup();

      await waitFor(() => {
        expect(screen.getByTestId('compatibility-badge-success')).toBeInTheDocument();
        expect(screen.getByText('85% compatible')).toBeInTheDocument();
      });
    });

    it('should show error badge when compatibility check fails', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockDatasourceType = 'prometheus';
      mockFetchCommunityDashboards.mockResolvedValue({
        page: 1,
        pages: 5,
        items: [createMockGnetDashboard()],
      });

      mockInterpolateDashboard.mockRejectedValue(new Error('Failed to interpolate dashboard'));

      await setup();

      await waitFor(() => {
        expect(screen.getByTestId('compatibility-badge-error')).toBeInTheDocument();
      });

      consoleErrorSpy.mockRestore();
    });

    it('should allow manual check when clicking Check button', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockDatasourceType = 'prometheus';
      mockFetchCommunityDashboards.mockResolvedValue({
        page: 1,
        pages: 5,
        items: [createMockGnetDashboard()],
      });

      // First call fails (simulating search result state), second call succeeds
      mockInterpolateDashboard
        .mockRejectedValueOnce(new Error('First auto-check fails'))
        .mockResolvedValueOnce(createMockDashboardJson({ title: 'Interpolated' }));
      mockCheckCompatibility.mockResolvedValue(createMockCompatibilityResult());

      const { user } = await setup();

      // Wait for error badge from auto-check
      await waitFor(() => {
        expect(screen.getByTestId('compatibility-badge-error')).toBeInTheDocument();
      });

      // Click to retry
      await user.click(screen.getByTestId('compatibility-badge-error'));

      // Should show success after retry
      await waitFor(() => {
        expect(screen.getByTestId('compatibility-badge-success')).toBeInTheDocument();
      });

      consoleErrorSpy.mockRestore();
    });

    it('should show loading state during compatibility check', async () => {
      mockDatasourceType = 'prometheus';
      mockFetchCommunityDashboards.mockResolvedValue({
        page: 1,
        pages: 5,
        items: [createMockGnetDashboard()],
      });

      // Create a promise that we control
      let resolveCheck: (value: CompatibilityCheckResult) => void;
      const checkPromise = new Promise<CompatibilityCheckResult>((resolve) => {
        resolveCheck = resolve;
      });

      mockInterpolateDashboard.mockResolvedValue(createMockDashboardJson({ title: 'Interpolated' }));
      mockCheckCompatibility.mockReturnValue(checkPromise);

      await setup();

      // Should show loading badge while check is in progress
      await waitFor(() => {
        expect(screen.getByTestId('compatibility-badge-loading')).toBeInTheDocument();
      });

      // Resolve the check
      resolveCheck!(createMockCompatibilityResult());

      // Should show success badge after check completes
      await waitFor(() => {
        expect(screen.getByTestId('compatibility-badge-success')).toBeInTheDocument();
      });
    });
  });

  describe('When dashboardValidatorApp is disabled', () => {
    testWithFeatureToggles({ disable: ['dashboardValidatorApp'] });

    it('should not show compatibility badge for prometheus datasources', async () => {
      mockDatasourceType = 'prometheus';
      mockFetchCommunityDashboards.mockResolvedValue({
        page: 1,
        pages: 5,
        items: [createMockGnetDashboard()],
      });

      await setup();

      await waitFor(() => {
        expect(screen.getByText('Test Dashboard')).toBeInTheDocument();
      });

      // Verify badge is not rendered
      expect(screen.queryByRole('button', { name: /Check/i })).not.toBeInTheDocument();
      expect(screen.queryByTestId('compatibility-badge-loading')).not.toBeInTheDocument();
      expect(screen.queryByTestId('compatibility-badge-success')).not.toBeInTheDocument();
    });

    it('should not trigger auto-checks on initial load', async () => {
      mockDatasourceType = 'prometheus';
      mockFetchCommunityDashboards.mockResolvedValue({
        page: 1,
        pages: 5,
        items: [createMockGnetDashboard()],
      });

      await setup();

      await waitFor(() => {
        expect(screen.getByText('Test Dashboard')).toBeInTheDocument();
      });

      // Verify no API calls were made
      expect(mockInterpolateDashboard).not.toHaveBeenCalled();
      expect(mockCheckCompatibility).not.toHaveBeenCalled();
      expect(DashboardLibraryInteractions.compatibilityCheckTriggered).not.toHaveBeenCalled();
    });
  });
});

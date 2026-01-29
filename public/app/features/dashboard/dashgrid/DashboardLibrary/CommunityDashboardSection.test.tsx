import { screen, waitFor } from '@testing-library/react';
import React from 'react';
import { render } from 'test/test-utils';

import { DashboardJson } from 'app/features/manage-dashboards/types';

import { CommunityDashboardSection } from './CommunityDashboardSection';
import { fetchCommunityDashboards } from './api/dashboardLibraryApi';
import { GnetDashboard } from './types';
import { onUseCommunityDashboard, interpolateDashboardForCompatibilityCheck } from './utils/communityDashboardHelpers';

jest.mock('./api/dashboardLibraryApi', () => ({
  fetchCommunityDashboards: jest.fn(),
}));

jest.mock('./utils/communityDashboardHelpers', () => ({
  ...jest.requireActual('./utils/communityDashboardHelpers'),
  onUseCommunityDashboard: jest.fn(),
  interpolateDashboardForCompatibilityCheck: jest.fn(),
}));

jest.mock('./CompatibilityModal', () => ({
  CompatibilityModal: jest.fn(() => <div>Compatibility Modal</div>),
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

const createMockGnetDashboard = (overrides: Partial<GnetDashboard> = {}): GnetDashboard => ({
  id: 1,
  name: 'Test Dashboard',
  description: 'Test Description',
  downloads: 2000,
  datasource: 'Prometheus',
  slug: 'test-dashboard',
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

  describe('Compatibility Check Feature', () => {
    it('should show "Check Compatibility" button when datasource type is prometheus', async () => {
      mockDatasourceType = 'prometheus';
      mockFetchCommunityDashboards.mockResolvedValue({
        page: 1,
        pages: 5,
        items: [createMockGnetDashboard()],
      });

      await setup();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Check compatibility' })).toBeInTheDocument();
      });
    });

    it('should hide "Check Compatibility" button when datasource type is not prometheus', async () => {
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

      expect(screen.queryByRole('button', { name: 'Check compatibility' })).not.toBeInTheDocument();
    });

    it('should hide "Check Compatibility" button when no datasourceUid in URL', async () => {
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
        expect(screen.queryByRole('button', { name: 'Check compatibility' })).not.toBeInTheDocument();
      });
    });

    it('should call interpolation function and open modal when "Check Compatibility" is clicked', async () => {
      mockDatasourceType = 'prometheus';
      mockFetchCommunityDashboards.mockResolvedValue({
        page: 1,
        pages: 5,
        items: [createMockGnetDashboard()],
      });

      const mockInterpolatedDashboard: DashboardJson = { title: 'Interpolated Dashboard' } as DashboardJson;
      mockInterpolateDashboard.mockResolvedValue(mockInterpolatedDashboard);

      const { user } = await setup();

      const checkCompatibilityButton = screen.getByRole('button', { name: 'Check compatibility' });
      await user.click(checkCompatibilityButton);

      await waitFor(() => {
        expect(mockInterpolateDashboard).toHaveBeenCalledWith(1, 'test-datasource-uid');
      });

      await waitFor(() => {
        expect(screen.getByText('Compatibility Modal')).toBeInTheDocument();
      });
    });

    it('should display error alert when interpolation fails', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockDatasourceType = 'prometheus';
      mockFetchCommunityDashboards.mockResolvedValue({
        page: 1,
        pages: 5,
        items: [createMockGnetDashboard()],
      });

      mockInterpolateDashboard.mockRejectedValue(
        new Error('Unable to automatically map all datasource inputs for this dashboard')
      );

      const { user } = await setup();

      const checkCompatibilityButton = screen.getByRole('button', { name: 'Check compatibility' });
      await user.click(checkCompatibilityButton);

      await waitFor(() => {
        expect(screen.getByText('Error loading dashboard')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(
          screen.getByText('Unable to automatically map all datasource inputs for this dashboard')
        ).toBeInTheDocument();
      });

      consoleErrorSpy.mockRestore();
    });
  });
});

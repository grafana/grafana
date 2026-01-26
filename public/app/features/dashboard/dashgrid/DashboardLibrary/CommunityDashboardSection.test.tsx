import { screen, waitFor } from '@testing-library/react';
import React from 'react';
import { render } from 'test/test-utils';

import { CommunityDashboardSection } from './CommunityDashboardSection';
import { fetchCommunityDashboards } from './api/dashboardLibraryApi';
import { GnetDashboard } from './types';
import { onUseCommunityDashboard } from './utils/communityDashboardHelpers';

jest.mock('./api/dashboardLibraryApi', () => ({
  fetchCommunityDashboards: jest.fn(),
}));

jest.mock('./utils/communityDashboardHelpers', () => ({
  ...jest.requireActual('./utils/communityDashboardHelpers'),
  onUseCommunityDashboard: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getInstanceSettings: jest.fn((uid: string) => ({
      uid,
      name: `DataSource ${uid}`,
      type: 'test',
    })),
  }),
}));

const mockFetchCommunityDashboards = fetchCommunityDashboards as jest.MockedFunction<typeof fetchCommunityDashboards>;
const mockOnUseCommunityDashboard = onUseCommunityDashboard as jest.MockedFunction<typeof onUseCommunityDashboard>;

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
  successScenario = true
) => {
  const renderResult = render(
    <CommunityDashboardSection onShowMapping={jest.fn()} datasourceType="test" {...props} />,
    {
      historyOptions: {
        initialEntries: ['/test?dashboardLibraryDatasourceUid=test-datasource-uid'],
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
});

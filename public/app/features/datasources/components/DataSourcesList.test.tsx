import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';

import { getMockDataSources } from '../mocks/dataSourcesMocks';

import { DataSourcesListView, ViewProps } from './DataSourcesList';

// Mock the useFavoriteDatasources hook
const mockIsFavoriteDatasource = jest.fn();
const mockUseFavoriteDatasources = jest.fn(() => ({
  enabled: true,
  isLoading: false,
  isFavoriteDatasource: mockIsFavoriteDatasource,
  favoriteDatasources: [],
  initialFavoriteDataSources: [],
  addFavoriteDatasource: jest.fn(),
  removeFavoriteDatasource: jest.fn(),
  toggleFavoriteDatasource: jest.fn(),
}));

jest.mock('@grafana/runtime', () => {
  const runtime = jest.requireActual('@grafana/runtime');
  return {
    ...runtime,
    useFavoriteDatasources: () => mockUseFavoriteDatasources(),
    config: {
      ...runtime.config,
      featureToggles: {
        ...runtime.config.featureToggles,
        favoriteDatasources: true,
      },
    },
  };
});

// Mock the useQueryParams hook
const mockUpdateQueryParams = jest.fn();
const mockUseQueryParams = jest.fn(() => [{ starred: undefined }, mockUpdateQueryParams]);

jest.mock('app/core/hooks/useQueryParams', () => ({
  useQueryParams: () => mockUseQueryParams(),
}));

// spy on hasRole to simulate admin
jest.spyOn(contextSrv, 'hasRole').mockImplementation((role: string) => role === 'Admin');

const setup = (overrides: Partial<ViewProps> = {}) => {
  const defaultProps = {
    dataSources: getMockDataSources(3),
    dataSourcesCount: 3,
    isLoading: false,
    hasCreateRights: true,
    hasWriteRights: true,
    hasExploreRights: true,
    showFavoritesOnly: false,
    handleFavoritesCheckboxChange: jest.fn(),
    ...overrides,
  };

  return render(<DataSourcesListView {...defaultProps} />);
};

describe('<DataSourcesList>', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseQueryParams.mockReturnValue([{ starred: undefined }, mockUpdateQueryParams]);
  });

  it('should render action bar', async () => {
    setup();

    expect(await screen.findByPlaceholderText('Search by name or type')).toBeInTheDocument();
    expect(await screen.findByRole('combobox', { name: 'Sort' })).toBeInTheDocument();
  });

  it('should render list of datasources', async () => {
    setup();

    expect(await screen.findAllByRole('listitem')).toHaveLength(3);
    expect(await screen.findAllByRole('link', { name: /dataSource-/i })).toHaveLength(3);
    expect(await screen.findAllByRole('link', { name: /Build a dashboard/i })).toHaveLength(3);
    expect(await screen.findAllByRole('link', { name: 'Explore' })).toHaveLength(3);
  });

  it('should render all elements in the list item', async () => {
    setup();

    expect(await screen.findByRole('link', { name: 'dataSource-0' })).toBeInTheDocument();
  });

  describe('Favorites functionality', () => {
    beforeEach(() => {
      config.featureToggles.favoriteDatasources = true;
    });

    it('should render favorites checkbox when feature toggle is enabled', async () => {
      setup({ favoriteDataSources: mockUseFavoriteDatasources() });

      const checkbox = await screen.findByRole('checkbox', { name: 'Starred' });
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).not.toBeChecked();
    });

    it('should not render favorites checkbox when feature toggle is disabled', async () => {
      config.featureToggles.favoriteDatasources = false;

      setup();

      expect(await screen.findByPlaceholderText('Search by name or type')).toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: 'Starred' })).not.toBeInTheDocument();
    });

    it('should render favorites checkbox as checked when value is true', async () => {
      setup({ showFavoritesOnly: true, favoriteDataSources: mockUseFavoriteDatasources() });

      const checkbox = await screen.findByRole('checkbox', { name: 'Starred' });
      expect(checkbox).toBeChecked();
    });

    it('should filter datasources to show only favorites when showFavoritesOnly is true', async () => {
      // Mock the isFavoriteDatasource function to return true for specific datasources
      const mockIsFavoriteDatasource = jest.fn((uid: string) => uid === 'uid-0' || uid === 'uid-2');

      setup({
        showFavoritesOnly: true,
        favoriteDataSources: {
          ...mockUseFavoriteDatasources(),
          isFavoriteDatasource: mockIsFavoriteDatasource,
        },
      });

      // Should only show 2 datasources (uid-0 and uid-2) instead of all 3
      const listItems = await screen.findAllByRole('listitem');
      expect(listItems).toHaveLength(2);

      // Verify the correct datasources are shown
      expect(screen.getByRole('link', { name: 'dataSource-0' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'dataSource-2' })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'dataSource-1' })).not.toBeInTheDocument();
    });
  });

  describe('Advisor health status', () => {
    const advisorHealthAvailable = (unhealthyUids: string[] = []) => ({
      healthMap: new Map(unhealthyUids.map((uid) => [uid, 'unhealthy' as const])),
      isLoading: false,
      isAvailable: true,
    });

    beforeEach(() => {
      config.featureToggles.grafanaAdvisor = true;
    });

    afterEach(() => {
      config.featureToggles.grafanaAdvisor = false;
    });

    it('should not show health filter when feature toggle is off', async () => {
      config.featureToggles.grafanaAdvisor = false;
      setup();

      expect(await screen.findByPlaceholderText('Search by name or type')).toBeInTheDocument();
      expect(screen.queryByRole('radio', { name: 'All' })).not.toBeInTheDocument();
    });

    it('should show health filter when feature toggle is on and user is admin', async () => {
      setup();

      expect(await screen.findByRole('radio', { name: 'All' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Healthy' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Unhealthy' })).toBeInTheDocument();
    });

    it('should show health filter even when no checks have run yet', async () => {
      // No advisorHealth prop = no data yet, but filter should still show
      setup();

      expect(await screen.findByRole('radio', { name: 'All' })).toBeInTheDocument();
    });

    it('should show unhealthy badge for datasources with failures', async () => {
      setup({ advisorHealth: advisorHealthAvailable(['uid-1']) });

      const listItems = await screen.findAllByRole('listitem');
      expect(listItems).toHaveLength(3);
      // The unhealthy datasource card (uid-1 = dataSource-1) should contain "Unhealthy" badge text
      const unhealthyCard = listItems[1];
      expect(within(unhealthyCard).getByText('Unhealthy')).toBeInTheDocument();
    });

    it('should not show unhealthy badge for healthy datasources', async () => {
      setup({ advisorHealth: advisorHealthAvailable(['uid-1']) });

      const listItems = await screen.findAllByRole('listitem');
      // Healthy cards should not contain "Unhealthy" text
      expect(within(listItems[0]).queryByText('Unhealthy')).not.toBeInTheDocument();
      expect(within(listItems[2]).queryByText('Unhealthy')).not.toBeInTheDocument();
    });

    it('should filter to show only unhealthy datasources', async () => {
      setup({ advisorHealth: advisorHealthAvailable(['uid-1']) });

      await screen.findAllByRole('listitem');
      await userEvent.click(screen.getByRole('radio', { name: 'Unhealthy' }));

      const listItems = await screen.findAllByRole('listitem');
      expect(listItems).toHaveLength(1);
      expect(screen.getByRole('heading', { name: 'dataSource-1' })).toBeInTheDocument();
    });

    it('should filter to show only healthy datasources', async () => {
      setup({ advisorHealth: advisorHealthAvailable(['uid-1']) });

      await screen.findAllByRole('listitem');
      await userEvent.click(screen.getByRole('radio', { name: 'Healthy' }));

      const listItems = await screen.findAllByRole('listitem');
      expect(listItems).toHaveLength(2);
      expect(screen.getByRole('heading', { name: 'dataSource-0' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'dataSource-2' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'dataSource-1' })).not.toBeInTheDocument();
    });

    it('should show empty state when filtering unhealthy and all are healthy', async () => {
      setup({ advisorHealth: advisorHealthAvailable([]) });

      await screen.findAllByRole('listitem');
      await userEvent.click(screen.getByRole('radio', { name: 'Unhealthy' }));

      expect(screen.getByText('No data sources found')).toBeInTheDocument();
    });
  });
});

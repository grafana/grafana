import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { mockBoundingClientRect } from '@grafana/test-utils';

import { getMockDataSources } from '../mocks/dataSourcesMocks';

import { DataSourcesListView, type ViewProps } from './DataSourcesList';

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

const setup = (overrides: Partial<ViewProps> = {}) => {
  const defaultProps = {
    dataSources: getMockDataSources(3),
    dataSourcesCount: 3,
    isLoading: false,
    hasCreateRights: true,
    hasWriteRights: true,
    hasExploreRights: true,
    showFavoritesOnly: false,
    sortable: false,
    handleFavoritesCheckboxChange: jest.fn(),
    ...overrides,
  };

  return render(<DataSourcesListView {...defaultProps} />);
};

describe('<DataSourcesList>', () => {
  beforeAll(() => {
    mockBoundingClientRect({ height: 500, width: 800 });
  });

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

  it('should virtualize long datasource lists', async () => {
    setup({
      dataSources: getMockDataSources(200),
      dataSourcesCount: 200,
    });

    const listItems = await screen.findAllByRole('listitem');
    expect(listItems.length).toBeGreaterThan(0);
    expect(listItems.length).toBeLessThan(200);
    expect(screen.queryByRole('link', { name: 'dataSource-199' })).not.toBeInTheDocument();
  });

  it('should increase overscan during keyboard navigation', async () => {
    setup({
      dataSources: getMockDataSources(200),
      dataSourcesCount: 200,
    });

    const initialItems = await screen.findAllByRole('listitem');
    expect(initialItems.length).toBeLessThan(200);

    const user = userEvent.setup();
    await user.tab();

    // After Tab, more items should be rendered due to increased overscan,
    // but not necessarily all of them (overscan is capped)
    await waitFor(() => expect(screen.getAllByRole('listitem').length).toBeGreaterThan(initialItems.length));
    const itemsAfterTab = screen.getAllByRole('listitem');
    expect(itemsAfterTab.length).toBeGreaterThan(initialItems.length);
  });

  it('should render loading skeletons when loading', async () => {
    setup({ isLoading: true, dataSourcesCount: 10 });

    const list = await screen.findByRole('list');
    expect(list).toBeInTheDocument();
    // LOADING_SKELETON_COUNT = 20
    await waitFor(() => expect(list.children).toHaveLength(20));
  });

  it('should have aria-label on list elements', async () => {
    setup();

    const list = await screen.findByRole('list');
    expect(list).toHaveAttribute('aria-label', 'Data sources');
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
});

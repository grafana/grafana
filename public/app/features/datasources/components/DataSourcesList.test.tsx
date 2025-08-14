import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { config } from '@grafana/runtime';

import { getMockDataSources } from '../mocks/dataSourcesMocks';

import { DataSourcesListView } from './DataSourcesList';

// Mock the useFavoriteDatasources hook
const mockIsFavoriteDatasource = jest.fn();
const mockUseFavoriteDatasources = jest.fn(() => ({
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

const setup = (overrides = {}) => {
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
    expect(await screen.findAllByRole('heading')).toHaveLength(3);
    expect(await screen.findAllByRole('link', { name: /Build a dashboard/i })).toHaveLength(3);
    expect(await screen.findAllByRole('link', { name: 'Explore' })).toHaveLength(3);
  });

  it('should render all elements in the list item', async () => {
    setup();

    expect(await screen.findByRole('heading', { name: 'dataSource-0' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'dataSource-0' })).toBeInTheDocument();
  });

  describe('Favorites functionality', () => {
    beforeEach(() => {
      config.featureToggles.favoriteDatasources = true;
    });

    it('should render favorites checkbox when feature toggle is enabled', async () => {
      setup();

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
      setup({ showFavoritesOnly: true });

      const checkbox = await screen.findByRole('checkbox', { name: 'Starred' });
      expect(checkbox).toBeChecked();
    });

    it('should filter datasources to show only favorites when showFavoritesOnly is true', async () => {
      // Mock the isFavoriteDatasource function to return true for specific datasources
      const mockIsFavoriteDatasource = jest.fn((uid: string) => uid === 'uid-0' || uid === 'uid-2');

      setup({
        showFavoritesOnly: true,
        isFavoriteDatasource: mockIsFavoriteDatasource,
      });

      // Should only show 2 datasources (uid-0 and uid-2) instead of all 3
      const listItems = await screen.findAllByRole('listitem');
      expect(listItems).toHaveLength(2);

      // Verify the correct datasources are shown
      expect(screen.getByRole('heading', { name: 'dataSource-0' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'dataSource-2' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'dataSource-1' })).not.toBeInTheDocument();
    });
  });
});

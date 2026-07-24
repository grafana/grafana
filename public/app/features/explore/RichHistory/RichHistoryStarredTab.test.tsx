import { fireEvent, render, screen, within } from '@testing-library/react';
import { TestProvider } from 'test/helpers/TestProvider';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';

import { SortOrder } from 'app/core/utils/richHistoryTypes';

import { RichHistoryStarredTab, type RichHistoryStarredTabProps } from './RichHistoryStarredTab';

jest.mock('../state/selectors', () => ({
  ...jest.requireActual('../state/selectors'),
  selectExploreDSMaps: jest
    .fn()
    .mockReturnValue({ dsToExplore: [{ datasource: { uid: 'active-ds-uid' } }], exploreToDS: [] }),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => {
    return {
      getList: () => [],
    };
  },
}));

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
}));

const setup = (propOverrides?: Partial<RichHistoryStarredTabProps>) => {
  const props: RichHistoryStarredTabProps = {
    queries: [],
    loading: false,
    loadError: false,
    totalQueries: 0,
    updateFilters: jest.fn(),
    loadMoreRichHistory: jest.fn(),
    clearRichHistoryResults: jest.fn(),
    richHistorySettings: {
      retentionPeriod: 7,
      starredTabAsFirstTab: false,
      activeDatasourcesOnly: false,
      lastUsedDatasourceFilters: [],
    },
    richHistorySearchFilters: {
      search: '',
      sortOrder: SortOrder.Ascending,
      datasourceFilters: [],
      from: 0,
      to: 7,
      starred: false,
    },
    activeDatasources: ['active-ds'],
    listOfDatasources: [{ name: 'active-ds', uid: 'active-ds-uid' }],
    isLoadingDatasources: false,
    dsListError: false,
  };

  Object.assign(props, propOverrides);

  const container = render(<RichHistoryStarredTab {...props} />, { wrapper: TestProvider });
  return container;
};

describe('RichHistoryStarredTab', () => {
  describe('sorter', () => {
    it('should render sorter', async () => {
      const container = setup();
      const sortText = await container.findByLabelText('Sort queries');
      expect(sortText).toBeInTheDocument();
    });
  });

  describe('select datasource', () => {
    it('should render select datasource if activeDatasourcesOnly is false', async () => {
      const container = setup();
      const filterText = await container.findByLabelText('Filter queries for data sources(s)');
      expect(filterText).toBeInTheDocument();
    });

    it('should not render select datasource if activeDatasourcesOnly is true', async () => {
      const container = setup({
        richHistorySettings: {
          retentionPeriod: 7,
          starredTabAsFirstTab: false,
          activeDatasourcesOnly: true,
          lastUsedDatasourceFilters: [],
        },
      });
      // trying to wait for placeholder text to render before proceeding does not work
      await container.findByPlaceholderText(/search queries/i);
      const filterText = container.queryByLabelText('Filter queries for data sources(s)');
      expect(filterText).not.toBeInTheDocument();
    });
  });

  it('should not regex escape filter input', async () => {
    const updateFiltersSpy = jest.fn();
    setup({ updateFilters: updateFiltersSpy });
    const input = await screen.findByPlaceholderText(/search queries/i);
    fireEvent.change(input, { target: { value: '|=' } });

    expect(updateFiltersSpy).toHaveBeenCalledWith(expect.objectContaining({ search: '|=' }));
  });

  it('updates the sort order filter when a new sort option is picked', async () => {
    const updateFiltersSpy = jest.fn();
    setup({ updateFilters: updateFiltersSpy });
    updateFiltersSpy.mockClear(); // ignore the mount seed

    const sortSelect = within(await screen.findByLabelText('Sort queries')).getByRole('combobox');
    await selectOptionInTest(sortSelect, 'Newest first');

    expect(updateFiltersSpy).toHaveBeenCalledWith(expect.objectContaining({ sortOrder: SortOrder.Descending }));
  });

  it('updates the datasource filter when a datasource is selected', async () => {
    const updateFiltersSpy = jest.fn();
    setup({ updateFilters: updateFiltersSpy });
    updateFiltersSpy.mockClear(); // ignore the mount seed

    const dsSelect = await screen.findByLabelText('Filter queries for data sources(s)');
    await selectOptionInTest(dsSelect, 'active-ds');

    expect(updateFiltersSpy).toHaveBeenCalledWith(expect.objectContaining({ datasourceFilters: ['active-ds'] }));
  });

  it('should show the loading message instead of cards while datasource instances are loading', async () => {
    setup({
      queries: [
        {
          id: '1',
          createdAt: 1,
          datasourceUid: 'active-ds-uid',
          datasourceName: 'active-ds',
          starred: true,
          comment: 'starred query comment',
          queries: [],
        },
      ],
    });

    // the datasource-instance fetch starts in a loading state, so the message
    // must show before any cards
    expect(screen.getByText('Loading results...')).toBeInTheDocument();
    expect(screen.queryByText('starred query comment')).not.toBeInTheDocument();

    // once instances resolve, cards render
    expect(await screen.findByText('starred query comment')).toBeInTheDocument();
  });

  it('should initialize with the last used datasource filters when active datasources only is disabled', async () => {
    const updateFiltersSpy = jest.fn();
    setup({
      updateFilters: updateFiltersSpy,
      richHistorySettings: {
        retentionPeriod: 7,
        starredTabAsFirstTab: false,
        activeDatasourcesOnly: false,
        lastUsedDatasourceFilters: ['saved-ds'],
      },
    });
    await screen.findByPlaceholderText(/search queries/i);

    expect(updateFiltersSpy).toHaveBeenCalledWith(
      expect.objectContaining({ datasourceFilters: ['saved-ds'], starred: true })
    );
  });

  it('should preserve cleared datasource filters when active datasources only is disabled', async () => {
    const updateFiltersSpy = jest.fn();
    setup({ updateFilters: updateFiltersSpy });
    await screen.findByPlaceholderText(/search queries/i);

    expect(updateFiltersSpy).toHaveBeenCalledWith(expect.objectContaining({ datasourceFilters: [], starred: true }));
  });

  it('should initialize with the active Explore datasource when active datasources only is enabled', async () => {
    const updateFiltersSpy = jest.fn();
    setup({
      updateFilters: updateFiltersSpy,
      richHistorySettings: {
        retentionPeriod: 7,
        starredTabAsFirstTab: false,
        activeDatasourcesOnly: true,
        lastUsedDatasourceFilters: ['saved-ds'],
      },
    });
    await screen.findByPlaceholderText(/search queries/i);

    expect(updateFiltersSpy).toHaveBeenCalledWith(
      expect.objectContaining({ datasourceFilters: ['active-ds'], starred: true })
    );
  });

  it('shows a datasource-list error instead of results when the list fails in active-only mode', async () => {
    setup({
      dsListError: true,
      richHistorySettings: {
        retentionPeriod: 7,
        starredTabAsFirstTab: false,
        activeDatasourcesOnly: true,
        lastUsedDatasourceFilters: [],
      },
    });
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('hides the partial-results "Load more" footer when loadError is true, even with stale partial results', async () => {
    setup({
      loadError: true,
      queries: [
        {
          id: '1',
          createdAt: 1,
          datasourceUid: 'active-ds-uid',
          datasourceName: 'active-ds',
          starred: true,
          comment: 'starred query comment',
          queries: [],
        },
      ],
      totalQueries: 2,
    });
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
  });
});

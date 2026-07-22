import { fireEvent, render, screen } from '@testing-library/react';
import { TestProvider } from 'test/helpers/TestProvider';

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

// Stable identity: a fresh array per render would re-trigger the component's
// useAsync (which depends on the datasource list) on every render.
const mockDataSourceItems = [{ name: 'active-ds', uid: 'active-ds-uid' }];

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  useDataSourceInstanceList: () => ({
    isLoading: false,
    items: mockDataSourceItems,
  }),
}));

const setup = (propOverrides?: Partial<RichHistoryStarredTabProps>) => {
  const props: RichHistoryStarredTabProps = {
    queries: [],
    loading: false,
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
});

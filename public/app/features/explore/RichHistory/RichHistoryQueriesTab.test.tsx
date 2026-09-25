import { fireEvent, render, screen, within } from '@testing-library/react';
// eslint-disable-next-line no-restricted-imports -- wildcard is used to spy on `useAsync`, not `useObservable`
import * as reactUse from 'react-use';
import { TestProvider } from 'test/helpers/TestProvider';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';
import { MockDataSourceApi } from 'test/mocks/datasource_srv';

import { type DataSourceSrv, setDataSourceSrv } from '@grafana/runtime';
import { SortOrder } from 'app/core/utils/richHistoryTypes';

import { RichHistoryQueriesTab, type RichHistoryQueriesTabProps } from './RichHistoryQueriesTab';

const asyncSpy = jest
  .spyOn(reactUse, 'useAsync')
  .mockReturnValue({ loading: false, value: [new MockDataSourceApi('test-ds')] });

const makeProps = (propOverrides?: Partial<RichHistoryQueriesTabProps>): RichHistoryQueriesTabProps => {
  const props: RichHistoryQueriesTabProps = {
    queries: [],
    totalQueries: 0,
    loading: false,
    loadError: false,
    updateFilters: jest.fn(),
    clearRichHistoryResults: jest.fn(),
    loadMoreRichHistory: jest.fn(),
    activeDatasources: ['test-ds'],
    listOfDatasources: [{ name: 'test-ds', uid: 'test-123' }],
    isLoadingDatasources: false,
    dsListError: false,
    richHistorySearchFilters: {
      search: '',
      sortOrder: SortOrder.Descending,
      datasourceFilters: ['test-ds'],
      from: 0,
      to: 30,
      starred: false,
    },
    richHistorySettings: {
      retentionPeriod: 30,
      activeDatasourcesOnly: false,
      lastUsedDatasourceFilters: ['test-ds'],
      starredTabAsFirstTab: false,
    },
    height: 100,
  };

  Object.assign(props, propOverrides);

  return props;
};

const setup = (propOverrides?: Partial<RichHistoryQueriesTabProps>) => {
  return render(<RichHistoryQueriesTab {...makeProps(propOverrides)} />, { wrapper: TestProvider });
};

describe('RichHistoryQueriesTab', () => {
  beforeAll(() => {
    const testDS = new MockDataSourceApi('test-ds');
    setDataSourceSrv({
      getList() {
        return [testDS];
      },
    } as unknown as DataSourceSrv);
  });
  afterEach(() => {
    asyncSpy.mockClear();
  });
  it('should render', async () => {
    setup();
    const filterHistory = await screen.findByText('Filter history');
    expect(filterHistory).toBeInTheDocument();
  });

  it('should not regex escape filter input', async () => {
    const updateFiltersSpy = jest.fn();
    setup({ updateFilters: updateFiltersSpy });
    const input = await screen.findByPlaceholderText(/search queries/i);
    fireEvent.change(input, { target: { value: '|=' } });

    expect(updateFiltersSpy).toHaveBeenCalledWith(expect.objectContaining({ search: '|=' }));
  });

  it('should update the filter and get data once on mount, and update the filter when the it changes', async () => {
    const updateFiltersSpy = jest.fn();
    setup({ updateFilters: updateFiltersSpy });
    expect(updateFiltersSpy).toHaveBeenCalledTimes(1);
    expect(asyncSpy).toHaveBeenCalledTimes(1);
    const input = await screen.findByLabelText(/remove/i);
    fireEvent.click(input);
    expect(updateFiltersSpy).toHaveBeenCalledTimes(2);
  });

  // The datasource list loads asynchronously; seeding filters before it resolves would leave
  // `activeDatasources` empty and never restrict history to the active Explore datasources.
  it('should not seed filters until the datasource list has loaded', async () => {
    const updateFiltersSpy = jest.fn();
    const activeDatasourcesOnlySettings = {
      retentionPeriod: 30,
      activeDatasourcesOnly: true,
      lastUsedDatasourceFilters: [],
      starredTabAsFirstTab: false,
    };

    const { rerender } = render(
      <RichHistoryQueriesTab
        {...makeProps({
          updateFilters: updateFiltersSpy,
          isLoadingDatasources: true,
          activeDatasources: [],
          richHistorySettings: activeDatasourcesOnlySettings,
        })}
      />,
      { wrapper: TestProvider }
    );

    // While the list is still loading, the effect must not seed with an empty datasource list.
    expect(updateFiltersSpy).not.toHaveBeenCalled();

    rerender(
      <RichHistoryQueriesTab
        {...makeProps({
          updateFilters: updateFiltersSpy,
          isLoadingDatasources: false,
          activeDatasources: ['test-ds'],
          richHistorySettings: activeDatasourcesOnlySettings,
        })}
      />
    );

    // Once resolved, it seeds exactly once, using the now-populated active datasources.
    expect(updateFiltersSpy).toHaveBeenCalledTimes(1);
    expect(updateFiltersSpy).toHaveBeenCalledWith(expect.objectContaining({ datasourceFilters: ['test-ds'] }));
  });

  it('updates the sort order filter when a new sort option is picked', async () => {
    const updateFiltersSpy = jest.fn();
    setup({ updateFilters: updateFiltersSpy });
    updateFiltersSpy.mockClear(); // ignore the mount seed

    const sortSelect = within(await screen.findByLabelText('Sort queries')).getByRole('combobox');
    await selectOptionInTest(sortSelect, 'Oldest first');

    expect(updateFiltersSpy).toHaveBeenCalledWith(expect.objectContaining({ sortOrder: SortOrder.Ascending }));
  });

  it('shows a datasource-list error instead of results when the list fails in active-only mode', () => {
    setup({
      dsListError: true,
      richHistorySettings: {
        retentionPeriod: 7,
        starredTabAsFirstTab: false,
        activeDatasourcesOnly: true,
        lastUsedDatasourceFilters: [],
      },
    });
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('hides the partial-results "Load more" footer when loadError is true, even with stale partial results', () => {
    setup({
      loadError: true,
      queries: [
        {
          id: '1',
          createdAt: 1,
          datasourceUid: 'test-123',
          datasourceName: 'test-ds',
          starred: false,
          comment: '',
          queries: [],
        },
      ],
      totalQueries: 2,
      richHistorySearchFilters: {
        search: '',
        sortOrder: SortOrder.Descending,
        datasourceFilters: ['test-ds'],
        from: 0,
        to: 30,
        starred: false,
      },
    });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
  });
});

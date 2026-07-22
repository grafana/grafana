import { fireEvent, render, screen } from '@testing-library/react';
// eslint-disable-next-line no-restricted-imports -- wildcard is used to spy on `useAsync`, not `useObservable`
import * as reactUse from 'react-use';
import { TestProvider } from 'test/helpers/TestProvider';
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
    updateFilters: jest.fn(),
    clearRichHistoryResults: jest.fn(),
    loadMoreRichHistory: jest.fn(),
    activeDatasources: ['test-ds'],
    listOfDatasources: [{ name: 'test-ds', uid: 'test-123' }],
    isLoadingDatasources: false,
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
});

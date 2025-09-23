import { fireEvent, render, screen } from '@testing-library/react';
import * as reactUse from 'react-use';
import { TestProvider } from 'test/helpers/TestProvider';
import { MockDataSourceApi } from 'test/mocks/datasource_srv';

import { DataSourceSrv, setDataSourceSrv } from '@grafana/runtime';
import { SortOrder } from 'app/core/utils/richHistoryTypes';

import { RichHistoryQueriesTab, RichHistoryQueriesTabProps } from './RichHistoryQueriesTab';

const asyncSpy = jest
  .spyOn(reactUse, 'useAsync')
  .mockReturnValue({ loading: false, value: [new MockDataSourceApi('test-ds')] });

const setup = (propOverrides?: Partial<RichHistoryQueriesTabProps>) => {
  const props: RichHistoryQueriesTabProps = {
    queries: [],
    totalQueries: 0,
    loading: false,
    updateFilters: jest.fn(),
    clearRichHistoryResults: jest.fn(),
    loadMoreRichHistory: jest.fn(),
    activeDatasources: ['test-ds'],
    listOfDatasources: [{ name: 'test-ds', uid: 'test-123' }],
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

  return render(<RichHistoryQueriesTab {...props} />, { wrapper: TestProvider });
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
});

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';

import { DataSourceSrv, setDataSourceSrv } from '@grafana/runtime';
import { SortOrder } from 'app/core/utils/richHistoryTypes';

import { RichHistoryQueriesTab, RichHistoryQueriesTabProps } from './RichHistoryQueriesTab';

const setup = (propOverrides?: Partial<RichHistoryQueriesTabProps>) => {
  const props: RichHistoryQueriesTabProps = {
    queries: [],
    totalQueries: 0,
    loading: false,
    updateFilters: jest.fn(),
    clearRichHistoryResults: jest.fn(),
    loadMoreRichHistory: jest.fn(),
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
      lastUsedDatasourceFilters: [],
      starredTabAsFirstTab: false,
    },
    height: 100,
  };

  Object.assign(props, propOverrides);

  return render(<RichHistoryQueriesTab {...props} />, { wrapper: TestProvider });
};

describe('RichHistoryQueriesTab', () => {
  beforeAll(() => {
    setDataSourceSrv({
      getList() {
        return [];
      },
    } as unknown as DataSourceSrv);
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
});

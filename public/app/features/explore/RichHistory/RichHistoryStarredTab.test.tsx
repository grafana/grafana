import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { SortOrder } from 'app/core/utils/richHistory';
import { ExploreId } from 'app/types';

import { RichHistoryStarredTab, RichHistoryStarredTabProps } from './RichHistoryStarredTab';

jest.mock('../state/selectors', () => ({ getExploreDatasources: jest.fn() }));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => {
    return {
      getList: () => [],
    };
  },
}));

const setup = (propOverrides?: Partial<RichHistoryStarredTabProps>) => {
  const props: RichHistoryStarredTabProps = {
    queries: [],
    loading: false,
    totalQueries: 0,
    activeDatasourceInstance: '',
    updateFilters: jest.fn(),
    loadMoreRichHistory: jest.fn(),
    clearRichHistoryResults: jest.fn(),
    exploreId: ExploreId.left,
    richHistorySettings: {
      retentionPeriod: 7,
      starredTabAsFirstTab: false,
      activeDatasourceOnly: false,
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

  const container = render(<RichHistoryStarredTab {...props} />);
  return container;
};

describe('RichHistoryStarredTab', () => {
  describe('sorter', () => {
    it('should render sorter', () => {
      const container = setup();
      expect(container.queryByLabelText('Sort queries')).toBeInTheDocument();
    });
  });

  describe('select datasource', () => {
    it('should render select datasource if activeDatasourceOnly is false', () => {
      const container = setup();
      expect(container.queryByLabelText('Filter queries for data sources(s)')).toBeInTheDocument();
    });

    it('should not render select datasource if activeDatasourceOnly is true', () => {
      const container = setup({
        richHistorySettings: {
          retentionPeriod: 7,
          starredTabAsFirstTab: false,
          activeDatasourceOnly: true,
          lastUsedDatasourceFilters: [],
        },
      });
      expect(container.queryByLabelText('Filter queries for data sources(s)')).not.toBeInTheDocument();
    });
  });

  it('should not regex escape filter input', () => {
    const updateFiltersSpy = jest.fn();
    setup({ updateFilters: updateFiltersSpy });
    const input = screen.getByPlaceholderText(/search queries/i);
    fireEvent.change(input, { target: { value: '|=' } });

    expect(updateFiltersSpy).toHaveBeenCalledWith(expect.objectContaining({ search: '|=' }));
  });
});

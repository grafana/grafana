import { fireEvent, render, screen } from '@testing-library/react';
import { TestProvider } from 'test/helpers/TestProvider';

import { SortOrder } from 'app/core/utils/richHistory';

import { RichHistoryStarredTab, RichHistoryStarredTabProps } from './RichHistoryStarredTab';

jest.mock('../state/selectors', () => ({ selectExploreDSMaps: jest.fn().mockReturnValue({ dsToExplore: [] }) }));

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
});

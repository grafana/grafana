import { DataFrame, DataFrameView, FieldType } from '@grafana/data';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { DashboardQueryResult, QueryResponse } from 'app/features/search/service/types';

import { listDashboards } from './services';

describe('browse-dashboards services', () => {
  describe('listDashboards', () => {
    const searchData: DataFrame = {
      fields: [
        { name: 'kind', type: FieldType.string, config: {}, values: [] },
        { name: 'name', type: FieldType.string, config: {}, values: [] },
        { name: 'uid', type: FieldType.string, config: {}, values: [] },
        { name: 'url', type: FieldType.string, config: {}, values: [] },
        { name: 'tags', type: FieldType.other, config: {}, values: [] },
        { name: 'location', type: FieldType.string, config: {}, values: [] },
      ],
      length: 0,
    };

    const mockSearchResult: QueryResponse = {
      isItemLoaded: jest.fn(),
      loadMoreItems: jest.fn(),
      totalRows: searchData.length,
      view: new DataFrameView<DashboardQueryResult>(searchData),
    };

    const searchMock = jest.spyOn(getGrafanaSearcher(), 'search');
    searchMock.mockResolvedValue(mockSearchResult);

    const PAGE_SIZE = 50;

    it.each([
      { page: undefined, expectedFrom: 0 },
      { page: 1, expectedFrom: 0 },
      { page: 2, expectedFrom: 50 },
      { page: 4, expectedFrom: 150 },
    ])('skips first $expectedFrom when listing page $page', async ({ page, expectedFrom }) => {
      await listDashboards('abc-123', page, PAGE_SIZE);

      expect(searchMock).toHaveBeenCalledWith({
        kind: ['dashboard'],
        query: '*',
        location: 'abc-123',
        from: expectedFrom,
        limit: PAGE_SIZE,
        offset: expectedFrom,
      });
    });
  });
});

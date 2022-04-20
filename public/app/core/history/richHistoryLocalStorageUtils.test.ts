import { SortOrder } from '../utils/richHistory';
import { RichHistoryQuery } from '../../types';
import { DataQuery } from '@grafana/data';
import { filterAndSortQueries } from './richHistoryLocalStorageUtils';

interface MockQuery extends DataQuery {
  expr: string;
  maxLines?: number | null;
}

const storedHistory: Array<RichHistoryQuery<MockQuery>> = [
  {
    id: '1',
    createdAt: 1,
    comment: '',
    datasourceUid: 'datasource uid',
    datasourceName: 'datasource history name',
    queries: [
      { expr: 'query1', maxLines: null, refId: '1' },
      { expr: 'query2', refId: '2' },
    ],
    starred: true,
  },
];

describe('filterQueries', () => {
  it('should filter out queries based on data source filter', () => {
    const filteredQueries = filterAndSortQueries(storedHistory, SortOrder.Ascending, ['not provided data source'], '');
    expect(filteredQueries).toHaveLength(0);
  });
  it('should keep queries based on data source filter', () => {
    const filteredQueries = filterAndSortQueries(storedHistory, SortOrder.Ascending, ['datasource history name'], '');
    expect(filteredQueries).toHaveLength(1);
  });
  it('should filter out all queries based on search filter', () => {
    const filteredQueries = filterAndSortQueries(storedHistory, SortOrder.Ascending, [], 'i do not exist in query');
    expect(filteredQueries).toHaveLength(0);
  });
  it('should include queries based on search filter', () => {
    const filteredQueries = filterAndSortQueries(storedHistory, SortOrder.Ascending, [], 'query1');
    expect(filteredQueries).toHaveLength(1);
  });
});

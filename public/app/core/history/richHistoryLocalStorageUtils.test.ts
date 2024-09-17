import { DataQuery } from '@grafana/data';
import { SortOrder } from 'app/core/utils/richHistory';

import { RichHistoryQuery } from '../../types';

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
  {
    id: '2',
    createdAt: 2,
    comment: 'comment 2',
    datasourceUid: 'datasource uid 2',
    datasourceName: 'datasource history name 2',
    queries: [
      { expr: 'query3', maxLines: null, refId: '1' },
      { expr: 'query4', refId: '2' },
    ],
    starred: true,
  },
];

describe('filterQueries', () => {
  it('should include all entries for empty filters', () => {
    const filteredQueries = filterAndSortQueries(storedHistory, SortOrder.Ascending, [], '');
    expect(filteredQueries).toMatchObject([expect.objectContaining({ id: '1' }), expect.objectContaining({ id: '2' })]);
  });
  it('should sort entries based on the filter', () => {
    const filteredQueries = filterAndSortQueries(storedHistory, SortOrder.Descending, [], '');
    expect(filteredQueries).toMatchObject([expect.objectContaining({ id: '2' }), expect.objectContaining({ id: '1' })]);
  });
  it('should filter out queries based on data source filter', () => {
    const filteredQueries = filterAndSortQueries(storedHistory, SortOrder.Ascending, ['not provided data source'], '');
    expect(filteredQueries).toHaveLength(0);
  });
  it('should keep queries based on data source filter', () => {
    const filteredQueries = filterAndSortQueries(storedHistory, SortOrder.Ascending, ['datasource history name'], '');
    expect(filteredQueries).toMatchObject([expect.objectContaining({ id: '1' })]);
  });
  it('should filter out all queries based on search filter', () => {
    const filteredQueries = filterAndSortQueries(storedHistory, SortOrder.Ascending, [], 'i do not exist in query');
    expect(filteredQueries).toHaveLength(0);
  });
  it('should include queries based on search filter', () => {
    const filteredQueries = filterAndSortQueries(storedHistory, SortOrder.Ascending, [], 'query1');
    expect(filteredQueries).toMatchObject([expect.objectContaining({ id: '1' })]);
  });
  it('should include queries based on comments', () => {
    const filteredQueries = filterAndSortQueries(storedHistory, SortOrder.Ascending, [], 'comment 2');
    expect(filteredQueries).toMatchObject([expect.objectContaining({ id: '2' })]);
  });
});

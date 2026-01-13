import { DataQuery } from '@grafana/schema';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard/constants';

import { isDashboardDatasource } from './useSQLSchemas';

describe('isDashboardDatasource', () => {
  it('identifies Dashboard datasource queries in a mixed set', () => {
    const queries: DataQuery[] = [
      { refId: 'A', datasource: { uid: 'prometheus-uid', type: 'prometheus' } },
      { refId: 'B', datasource: { uid: SHARED_DASHBOARD_QUERY, type: 'datasource' } },
      { refId: 'C', datasource: { uid: 'mysql-uid', type: 'mysql' } },
    ];

    const backendQueries = queries.filter((q) => !isDashboardDatasource(q));

    expect(backendQueries.map((q) => q.refId)).toEqual(['A', 'C']);
  });

  it('returns true when query has dashboard datasource uid', () => {
    const query: DataQuery = {
      refId: 'A',
      datasource: { uid: SHARED_DASHBOARD_QUERY, type: 'datasource' },
    };
    expect(isDashboardDatasource(query)).toBe(true);
  });
});

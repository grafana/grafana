import { DataSourceApi, DataQueryRequest, DataQueryResponse } from '@grafana/ui';
import { DashboardQuery } from './types';

/**
 * This should not really be called
 */
export class DashboardDatasource implements DataSourceApi<DashboardQuery> {
  getCollapsedText(query: DashboardQuery) {
    return `Dashboard Reference: ${query.panelId}`;
  }

  query(options: DataQueryRequest<DashboardQuery>): Promise<DataQueryResponse> {
    return Promise.reject('This should not be called directly');
  }

  testDatasource() {
    return Promise.resolve({});
  }
}

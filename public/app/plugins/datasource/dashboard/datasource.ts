import { DataSourceApi, DataQueryOptions, DataQueryResponse } from '@grafana/ui';
import { DashboardQuery } from './types';

/**
 * This is never really called
 */
class DashboardDatasource implements DataSourceApi<DashboardQuery> {
  constructor() {
    console.log('Constructor!', this);
  }

  getCollapsedText(query: DashboardQuery) {
    console.log('COLLAPSED:', this, query);
    return `Dashboard Reference: ${query.panelId}`;
  }

  query(options: DataQueryOptions<DashboardQuery>): Promise<DataQueryResponse> {
    // ??? get the panel and call refresh?
    console.log('Query!', this);

    return Promise.reject('This should not be called directly');
  }

  testDatasource() {
    return new Promise((resolve, reject) => {
      resolve({
        status: 'success',
        message: 'yes!',
      });
    });
  }
}

export { DashboardDatasource, DashboardDatasource as Datasource };

import { DataSourceApi, DataQueryOptions, DataQueryResponse } from '@grafana/ui';
import { DashboardQuery } from './types';
import { DashboardModel } from 'app/features/dashboard/state';

let counter = 100;

class DashboardDatasource implements DataSourceApi<DashboardQuery> {
  xxx: number;

  constructor() {
    console.log('Constructor!', this);

    this.xxx = counter++;
  }

  dashboard: DashboardModel;

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

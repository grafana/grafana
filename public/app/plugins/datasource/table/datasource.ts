// Libraries
import _ from 'lodash';

// Types
import { DataQueryOptions, SeriesData, DataQueryResponse, DataSourceApi } from '@grafana/ui/src/types';
import { TableQuery } from './types';

export class TableDatasource implements DataSourceApi<TableQuery> {
  data: SeriesData[];

  /** @ngInject */
  constructor(instanceSettings: any) {
    if (instanceSettings.jsonData) {
      this.data = instanceSettings.jsonData.data;
    }

    if (!this.data) {
      this.data = [];
    }
  }

  metricFindQuery(query: string, options?: any) {
    return new Promise((resolve, reject) => {
      const names = [];
      for (const series of this.data) {
        for (const field of series.fields) {
          // TODO, match query/options?
          names.push({
            text: field.name,
          });
        }
      }
      resolve(names);
    });
  }

  query(options: DataQueryOptions<TableQuery>): Promise<DataQueryResponse> {
    const queryTargets = options.targets.filter(target => !target.hide);

    if (queryTargets.length === 0) {
      return Promise.resolve({ data: [] });
    }

    return Promise.resolve({ data: this.data });
  }

  testDatasource() {
    return new Promise((resolve, reject) => {
      let rowCount = 0;
      let info = `${this.data.length} Series:`;
      for (const series of this.data) {
        info += ` [${series.fields.length} Fields, ${series.rows.length} Rows]`;
        rowCount += series.rows.length;
      }

      if (rowCount > 0) {
        resolve({
          status: 'success',
          message: info,
        });
      }
      reject({
        status: 'error',
        message: 'No Rows Entered',
      });
    });
  }
}

export default TableDatasource;

// Libraries
import _ from 'lodash';

// Types
import {
  DataQueryOptions,
  SeriesData,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
} from '@grafana/ui/src/types';
import { InputQuery } from './types';

export class InputDatasource implements DataSourceApi<InputQuery> {
  data: SeriesData[];

  // Filled in by grafana plugin system
  name?: string;

  // Filled in by grafana plugin system
  id?: number;

  /** @ngInject */
  constructor(instanceSettings: DataSourceInstanceSettings) {
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

  query(options: DataQueryOptions<InputQuery>): Promise<DataQueryResponse> {
    const results: SeriesData[] = [];
    for (const query of options.targets) {
      if (query.hide) {
        continue;
      }
      for (const series of this.data) {
        results.push({
          refId: query.refId,
          ...series,
        });
      }
    }

    return Promise.resolve({ data: results });
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
        message: 'No Data Entered',
      });
    });
  }
}

export default InputDatasource;

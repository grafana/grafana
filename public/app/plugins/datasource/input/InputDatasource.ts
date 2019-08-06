// Types
import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  MetricFindValue,
} from '@grafana/ui';
import { DataFrame } from '@grafana/data';

import { InputQuery, InputOptions } from './types';

export class InputDatasource extends DataSourceApi<InputQuery, InputOptions> {
  data: DataFrame[];

  constructor(instanceSettings: DataSourceInstanceSettings<InputOptions>) {
    super(instanceSettings);

    this.data = instanceSettings.jsonData.data ? instanceSettings.jsonData.data : [];
  }

  /**
   * Convert a query to a simple text string
   */
  getQueryDisplayText(query: InputQuery): string {
    if (query.data) {
      return 'Panel Data: ' + describeDataFrame(query.data);
    }
    return `Shared Data From: ${this.name} (${describeDataFrame(this.data)})`;
  }

  metricFindQuery(query: string, options?: any): Promise<MetricFindValue[]> {
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

  query(options: DataQueryRequest<InputQuery>): Promise<DataQueryResponse> {
    const results: DataFrame[] = [];
    for (const query of options.targets) {
      if (query.hide) {
        continue;
      }
      const data = query.data ? query.data : this.data;
      for (const series of data) {
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

export function describeDataFrame(data: DataFrame[]): string {
  if (!data || !data.length) {
    return '';
  }
  if (data.length > 1) {
    const count = data.reduce((acc, series) => {
      return acc + series.rows.length;
    }, 0);
    return `${data.length} Series, ${count} Rows`;
  }
  const series = data[0];
  if (!series.fields) {
    return 'Missing Fields';
  }
  return `${series.fields.length} Fields, ${series.rows.length} Rows`;
}

export default InputDatasource;

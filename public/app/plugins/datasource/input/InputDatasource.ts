// Types
import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  MetricFindValue,
  DataFrame,
  DataFrameDTO,
  toDataFrame,
} from '@grafana/data';

import { InputQuery, InputOptions } from './types';

export class InputDatasource extends DataSourceApi<InputQuery, InputOptions> {
  data: DataFrame[] = [];

  constructor(instanceSettings: DataSourceInstanceSettings<InputOptions>) {
    super(instanceSettings);

    if (instanceSettings.jsonData.data) {
      this.data = instanceSettings.jsonData.data.map(v => toDataFrame(v));
    }
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
      let data = this.data;
      if (query.data) {
        data = query.data.map(v => toDataFrame(v));
      }
      for (let i = 0; i < data.length; i++) {
        results.push({
          ...data[i],
          refId: query.refId,
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
        const length = series.length;
        info += ` [${series.fields.length} Fields, ${length} Rows]`;
        rowCount += length;
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

function getLength(data?: DataFrameDTO | DataFrame) {
  if (!data || !data.fields || !data.fields.length) {
    return 0;
  }
  if (data.hasOwnProperty('length')) {
    return (data as DataFrame).length;
  }
  return data.fields[0].values.length;
}

export function describeDataFrame(data: Array<DataFrameDTO | DataFrame>): string {
  if (!data || !data.length) {
    return '';
  }
  if (data.length > 1) {
    const count = data.reduce((acc, series) => {
      return acc + getLength(series);
    }, 0);
    return `${data.length} Series, ${count} Rows`;
  }
  const series = data[0];
  if (!series.fields) {
    return 'Missing Fields';
  }
  const length = getLength(series);
  return `${series.fields.length} Fields, ${length} Rows`;
}

export default InputDatasource;

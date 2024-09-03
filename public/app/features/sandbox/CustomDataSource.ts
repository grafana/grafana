import {
  DataFrameType,
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  FieldType,
  LoadingState,
  TestDataSourceResponse,
} from '@grafana/data';
import { RuntimeDataSource } from '@grafana/scenes';

export class MyCustomDS extends RuntimeDataSource {
  query(request: DataQueryRequest<DataQuery>): Promise<DataQueryResponse> {
    const howManyValues = 6;
    return Promise.resolve({
      state: LoadingState.Done,
      data: [
        {
          meta: {
            type: DataFrameType.LogLines,
          },
          fields: [
            {
              config: {},
              name: 'labels',
              type: FieldType.other,
              values: [
                { app: 'grafana', cluster: 'dev-us-central-0', container: 'hg-plugins' },
                { app: 'grafana', cluster: 'dev-us-central-1', container: 'hg-plugins' },
                { app: 'grafana', cluster: 'dev-us-central-2', container: 'hg-plugins' },
              ],
            },
            {
              config: {},
              name: 'timestamp',
              type: FieldType.time,
              values: [
                '2019-01-01 10:00:00',
                '2019-01-01 11:00:00',
                '2019-01-01 12:00:00',
                '2019-01-01 13:00:00',
                '2019-01-01 14:00:00',
                '2019-01-01 15:00:00',
              ].slice(0, howManyValues),
            },
            {
              config: {},
              name: 'body',
              type: FieldType.string,
              values: [
                'log message 1',
                'log message 2',
                'log message 3',
                'log message 4',
                'log message 5',
                'log message 6',
              ].slice(0, howManyValues),
            },
            {
              config: {},
              name: 'tsNs',
              type: FieldType.string,
              values: [
                '1697561006608165746',
                '1697560998869868000',
                '1697561010006578474',
                '1697561010006578475',
                '1697561010006578476',
                '1697561010006578477',
              ].slice(0, howManyValues),
            },
            {
              config: {},
              name: 'id',
              type: FieldType.string,
              values: [
                '1697561006608165746_b4cc4b72',
                '1697560998869868000_eeb96c0f',
                '1697561010006578474_ad5e2e5a',
                '1697561010006578474_ad5e2e5b',
                '1697561010006578474_ad5e2e5c',
                '1697561010006578474_ad5e2e5d',
              ].slice(0, howManyValues),
            },
            {
              config: {
                links: [
                  {
                    url: 'http://example.com',
                    title: 'foo',
                  },
                ],
              },
              name: 'traceID',
              type: FieldType.string,
              values: ['trace1', 'trace2', 'trace3', 'trace4', 'trace5', 'trace6'].slice(0, howManyValues),
            },
          ],
          length: howManyValues,
        },
      ],
    });
  }

  testDatasource(): Promise<TestDataSourceResponse> {
    return Promise.resolve({ status: 'success', message: 'OK' });
  }
}

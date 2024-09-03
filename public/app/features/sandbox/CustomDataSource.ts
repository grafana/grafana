import {
  DataFrameType,
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  LoadingState,
  TestDataSourceResponse,
} from '@grafana/data';
import { RuntimeDataSource } from '@grafana/scenes';

export class MyCustomDS extends RuntimeDataSource {
  query(request: DataQueryRequest<DataQuery>): Promise<DataQueryResponse> {
    return Promise.resolve({
      state: LoadingState.Done,
      data: [
        {
          name: 'infra Stats',
          fields: [
            {
              name: 'started',
              type: 'time',
              values: [1635319376502, 1635319376502, 1635319796502, 1635319796502],
            },
            {
              name: 'server',
              type: 'string',
              values: ['Server A started', 'Server B started', 'Server A shutdown', 'Server B shutdown'],
            },
            {
              name: 'level',
              type: 'string',
              values: ['info', 'info', 'error', 'warn'],
            },
          ],
        },
      ],
    });
  }

  testDatasource(): Promise<TestDataSourceResponse> {
    return Promise.resolve({ status: 'success', message: 'OK' });
  }
}

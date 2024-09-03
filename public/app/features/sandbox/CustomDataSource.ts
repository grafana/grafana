import { DataQuery, DataQueryRequest, DataQueryResponse, LoadingState, TestDataSourceResponse } from '@grafana/data';
import { RuntimeDataSource } from '@grafana/scenes';

import { ExtensionsLog } from '../plugins/extensions/log';

export class MyCustomDS extends RuntimeDataSource {
  extensionsLog: ExtensionsLog;
  constructor(
    public readonly uid: string,
    public readonly pluginId: string
  ) {
    super(uid, pluginId);
    this.extensionsLog = new ExtensionsLog();
  }

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

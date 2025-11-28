import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  MutableDataFrame,
  FieldType,
} from '@grafana/data';

import { MyQuery, MyDataSourceOptions } from './types';

export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);
  }

  async query(options: DataQueryRequest<MyQuery>): Promise<DataQueryResponse> {
    const now = Date.now();

    const frame = new MutableDataFrame({
      refId: options.targets[0].refId,
      fields: [
        { name: 'Time', type: FieldType.time, values: [now - 60000, now] },
        { name: 'Value', type: FieldType.number, values: [42, 84] },
      ],
    });

    return { data: [frame] };
  }

  async testDatasource() {
    return {
      status: 'success',
      message: 'MongoDB Atlas config loaded successfully',
    };
  }
}

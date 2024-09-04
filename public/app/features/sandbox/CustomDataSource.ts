import { map, Observable } from 'rxjs';

import {
  CircularDataFrame,
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  FieldType,
  LoadingState,
  TestDataSourceResponse,
} from '@grafana/data';
import { RuntimeDataSource } from '@grafana/scenes';

import { ExtensionsLog, LogItem } from '../plugins/extensions/log';

export class MyCustomDS extends RuntimeDataSource {
  extensionsLog: ExtensionsLog;
  constructor(
    public readonly uid: string,
    public readonly pluginId: string
  ) {
    super(pluginId, uid);
    this.extensionsLog = new ExtensionsLog();
  }

  query(request: DataQueryRequest<DataQuery>): Observable<DataQueryResponse> {
    const [query] = request.targets;
    const frame = new CircularDataFrame({
      append: 'tail',
      capacity: 1000,
    });

    frame.refId = query.refId;
    frame.addField({ name: 'time', type: FieldType.time });
    frame.addField({ name: 'body', type: FieldType.string });
    frame.addField({ name: 'severity', type: FieldType.string });
    frame.addField({ name: 'id', type: FieldType.string });
    frame.addField({ name: 'labels', type: FieldType.other });
    if (!frame.meta) {
      frame.meta = {};
    }
    frame.meta.type = DataFrameType.LogLines;

    return this.extensionsLog.asObservable().pipe(
      map((item: LogItem) => {
        frame.add({
          time: item.ts,
          body: item.message,
          severity: String(item.level),
          id: item.id,
          labels: item.obj,
        });

        return {
          data: [frame],
          key: query.refId,
          state: LoadingState.Streaming,
        };
      })
    );
  }

  testDatasource(): Promise<TestDataSourceResponse> {
    return Promise.resolve({ status: 'success', message: 'OK' });
  }
}

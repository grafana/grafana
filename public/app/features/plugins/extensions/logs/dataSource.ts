import { map, Observable } from 'rxjs';

import {
  CircularDataFrame,
  DataFrameType,
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  FieldType,
  LoadingState,
  TestDataSourceResponse,
} from '@grafana/data';
import { RuntimeDataSource } from '@grafana/scenes';

import { ExtensionsLog, LogItem } from './log';

export class ExtensionsLogDataSource extends RuntimeDataSource {
  extensionsLog: ExtensionsLog;
  constructor(
    public readonly pluginId: string,
    public readonly uid: string
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
    frame.addField({ name: 'timestamp', type: FieldType.time });
    frame.addField({ name: 'body', type: FieldType.string });
    frame.addField({ name: 'severity', type: FieldType.string });
    frame.addField({ name: 'id', type: FieldType.string });
    frame.addField({ name: 'labels', type: FieldType.other });
    frame.meta = { ...frame.meta, type: DataFrameType.LogLines };

    return this.extensionsLog.asObservable().pipe(
      map((item: LogItem) => {
        frame.add({
          timestamp: item.timestamp,
          body: item.message,
          severity: item.level,
          id: item.id,
          labels: item.labels,
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

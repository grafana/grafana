import { isString } from 'lodash';
import { filter, map, Observable, tap } from 'rxjs';

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

type LogDataQuery = DataQuery & {
  pluginIds?: Set<string>;
  extensionPointIds?: Set<string>;
  levels?: Set<string>;
};

export class ExtensionsLogDataSource extends RuntimeDataSource<LogDataQuery> {
  private pluginIds: Set<string>;
  private extensionPointIds: Set<string>;
  private levels: Set<string>;

  constructor(
    public readonly pluginId: string,
    public readonly uid: string,
    private readonly extensionsLog: ExtensionsLog
  ) {
    super(pluginId, uid);

    this.pluginIds = new Set<string>();
    this.extensionPointIds = new Set<string>();
    this.levels = new Set<string>();
  }

  getPluginIds(): string[] {
    return Array.from(this.pluginIds);
  }

  getExtensionPointIds(): string[] {
    return Array.from(this.extensionPointIds);
  }

  getLevels(): string[] {
    return Array.from(this.levels);
  }

  query(request: DataQueryRequest<LogDataQuery>): Observable<DataQueryResponse> {
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
      tap((item: LogItem) => {
        if (item.level) {
          this.levels.add(item.level);
        }
        if (isString(item.labels['pluginId'])) {
          this.pluginIds.add(item.labels['pluginId']);
        }
        if (isString(item.labels['extensionPointId'])) {
          this.pluginIds.add(item.labels['extensionPointId']);
        }
      }),
      filter((item: LogItem, index: number) => {
        const { extensionPointIds, levels, pluginIds } = query;

        if (extensionPointIds) {
          const pointId = item.labels['extensionPointId'];
          if (isString(pointId)) {
            return extensionPointIds.has(pointId);
          } else {
            return false;
          }
        }

        if (levels) {
          return levels.has(item.level);
        }

        if (pluginIds) {
          const pluginId = item.labels['pluginId'];
          if (isString(pluginId)) {
            return pluginIds.has(pluginId);
          }
          return false;
        }

        return true;
      }),
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

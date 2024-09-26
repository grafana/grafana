import { isString } from 'lodash';
import { filter, finalize, Observable, scan, tap } from 'rxjs';

import {
  createDataFrame,
  DataFrame,
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

    return this.extensionsLog.asObservable().pipe(
      tap((item: LogItem) => {
        if (isString(item.labels['pluginId'])) {
          this.pluginIds.add(item.labels['pluginId']);
        }
      }),
      filter((item: LogItem) => {
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
      tap((item: LogItem) => {
        if (item.level) {
          this.levels.add(item.level);
        }
        if (isString(item.labels['extensionPointId'])) {
          this.extensionPointIds.add(item.labels['extensionPointId']);
        }
      }),
      scan<LogItem, DataQueryResponse>(
        (response, item) => {
          const [existing] = response.data;

          return {
            data: [createFrame(query, item, existing)],
            key: query.key ?? query.refId,
            state: LoadingState.Streaming,
          };
        },
        {
          data: [],
          key: query.key ?? query.refId,
          state: LoadingState.Streaming,
        }
      ),
      finalize(() => {
        // this will clean out the fiters on every re-run of the query
        this.levels = new Set<string>();
        this.extensionPointIds = new Set<string>();
        this.pluginIds = new Set<string>();
      })
    );
  }

  testDatasource(): Promise<TestDataSourceResponse> {
    return Promise.resolve({ status: 'success', message: 'OK' });
  }
}

function createFrame(query: LogDataQuery, item: LogItem, existing?: DataFrame): DataFrame {
  const timestamps = existing?.fields?.[0]?.values ?? [];
  const messages = existing?.fields?.[1]?.values ?? [];
  const levels = existing?.fields?.[2]?.values ?? [];
  const ids = existing?.fields?.[3]?.values ?? [];
  const labels = existing?.fields?.[4]?.values ?? [];

  return createDataFrame({
    refId: query.refId,
    meta: { type: DataFrameType.LogLines },
    fields: [
      { name: 'timestamp', type: FieldType.time, values: [item.timestamp, ...timestamps] },
      { name: 'body', type: FieldType.string, values: [item.message, ...messages] },
      { name: 'severity', type: FieldType.string, values: [item.level, ...levels] },
      { name: 'id', type: FieldType.string, values: [item.id, ...ids] },
      { name: 'labels', type: FieldType.other, values: [item.labels, ...labels] },
    ],
  });
}

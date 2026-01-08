import { Observable, scan } from 'rxjs';

import {
  createDataFrame,
  DataFrame,
  DataFrameType,
  DataQueryRequest,
  DataQueryResponse,
  FieldType,
  LoadingState,
  TestDataSourceResponse,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { RuntimeDataSource, SceneDataQuery } from '@grafana/scenes';

import { ExtensionsLog, ExtensionsLogItem } from './log';

export class ExtensionsLogDataSource extends RuntimeDataSource {
  constructor(
    public readonly pluginId: string,
    public readonly uid: string,
    private readonly extensionsLog: ExtensionsLog
  ) {
    super(pluginId, uid);
  }

  query(request: DataQueryRequest): Observable<DataQueryResponse> {
    const [query] = request.targets;

    return this.extensionsLog.asObservable().pipe(
      scan<ExtensionsLogItem, DataQueryResponse>(
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
      )
    );
  }

  testDatasource(): Promise<TestDataSourceResponse> {
    return Promise.resolve({ status: 'success', message: t('plugins.extensions-log-data-source.message.ok', 'OK') });
  }
}

function createFrame(query: SceneDataQuery, item: ExtensionsLogItem, existing?: DataFrame): DataFrame {
  const timestamps = existing?.fields?.[0]?.values ?? [];
  const messages = existing?.fields?.[1]?.values ?? [];
  const levels = existing?.fields?.[2]?.values ?? [];
  const ids = existing?.fields?.[3]?.values ?? [];
  const labels = existing?.fields?.[4]?.values ?? [];
  const pluginIds = existing?.fields?.[5]?.values ?? [];
  const extensionPointIds = existing?.fields?.[6]?.values ?? [];

  return createDataFrame({
    refId: query.refId,
    meta: { type: DataFrameType.LogLines },
    fields: [
      {
        name: 'timestamp',
        type: FieldType.time,
        values: [item.timestamp, ...timestamps],
      },
      {
        name: 'body',
        type: FieldType.string,
        values: [item.message, ...messages],
      },
      {
        name: 'severity',
        type: FieldType.string,
        values: [item.level, ...levels],
      },
      {
        name: 'id',
        type: FieldType.string,
        values: [item.id, ...ids],
      },
      {
        name: 'labels',
        type: FieldType.other,
        values: [item.labels, ...labels],
      },
      {
        name: 'pluginId',
        type: FieldType.string,
        values: [item.pluginId ?? null, ...pluginIds],
      },
      {
        name: 'extensionPointId',
        type: FieldType.string,
        values: [item.extensionPointId ?? null, ...extensionPointIds],
      },
    ],
  });
}

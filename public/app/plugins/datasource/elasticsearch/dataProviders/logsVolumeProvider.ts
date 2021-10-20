import {
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  getLogLevelFromKey,
  LoadingState,
  toDataFrame,
} from '@grafana/data';
import { ElasticsearchQuery } from '../types';
import { Observable } from 'rxjs';
import { cloneDeep } from 'lodash';
import { ElasticDatasource } from '../datasource';
import { aggregateRawLogsVolume } from '../../../../core/logs_model';

export function createElasticSearchLogsVolumeProvider(
  datasource: ElasticDatasource,
  dataQueryRequest: DataQueryRequest<ElasticsearchQuery>
): Observable<DataQueryResponse> {
  const logsVolumeRequest = cloneDeep(dataQueryRequest);
  logsVolumeRequest.targets = logsVolumeRequest.targets.map((target) => {
    const logsVolumeQuery: ElasticsearchQuery = {
      refId: target.refId,
      query: target.query,
      metrics: [{ type: 'count', id: '1' }],
      timeField: '@timestamp',
      bucketAggs: [
        {
          id: '2',
          type: 'terms',
          settings: {
            min_doc_count: '0',
            size: '0',
            order: 'desc',
            orderBy: '_count',
          },
          field: 'fields.level',
        },
        {
          id: '3',
          type: 'date_histogram',
          settings: {
            interval: 'auto',
            min_doc_count: '0',
            trimEdges: '0',
          },
          field: '@timestamp',
        },
      ],
    };
    return logsVolumeQuery;
  });

  return new Observable((observer) => {
    let rawLogsVolume: DataFrame[] = [];
    observer.next({
      state: LoadingState.Loading,
      error: undefined,
      data: [],
    });

    const subscription = datasource.query(logsVolumeRequest).subscribe({
      complete: () => {
        const aggregatedLogsVolume = aggregateRawLogsVolume(rawLogsVolume, (dataFrame) =>
          getLogLevelFromKey(dataFrame.name || '')
        );
        if (aggregatedLogsVolume[0]) {
          aggregatedLogsVolume[0].meta = {
            custom: {
              targets: dataQueryRequest.targets,
              absoluteRange: { from: dataQueryRequest.range.from.valueOf(), to: dataQueryRequest.range.to.valueOf() },
            },
          };
        }
        observer.next({
          state: LoadingState.Done,
          error: undefined,
          data: aggregatedLogsVolume,
        });
        observer.complete();
      },
      next: (dataQueryResponse: DataQueryResponse) => {
        rawLogsVolume = rawLogsVolume.concat(dataQueryResponse.data.map(toDataFrame));
      },
      error: (error) => {
        observer.next({
          state: LoadingState.Error,
          error: error,
          data: [],
        });
        observer.error(error);
      },
    });
    return () => {
      subscription?.unsubscribe();
    };
  });
}

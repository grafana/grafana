import { cloneDeep, groupBy } from 'lodash';
import { from, mergeMap, Observable, of } from 'rxjs';
import { scan } from 'rxjs/operators';

import {
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  hasSupplementaryQuerySupport,
  LoadingState,
  LogsVolumeType,
  SupplementaryQueryType,
} from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';

import {
  BatchedQueries,
  MIXED_DATASOURCE_NAME,
  MixedDatasource,
} from '../../../plugins/datasource/mixed/MixedDataSource';
import { ExplorePanelData } from '../../../types';

const createFallbackLogVolumeProvider = (
  explorePanelData: Observable<ExplorePanelData>
): Observable<DataQueryResponse> => {
  return new Observable<DataQueryResponse>((observer) => {
    explorePanelData.subscribe((exploreData) => {
      if (exploreData.logsResult?.series && exploreData.logsResult?.visibleRange) {
        observer.next({
          data: exploreData.logsResult.series.map((d) => {
            const custom = d.meta?.custom || {};
            return {
              ...d,
              meta: {
                custom: {
                  ...custom,
                  logsVolumeType: LogsVolumeType.Limited,
                  absoluteRange: exploreData.logsResult?.visibleRange,
                },
              },
            };
          }),
          state: LoadingState.Done,
        });
      }
    });
  });
};

const enrichWithLogsVolumeSource = (uid: string, title: string) => {
  return mergeMap((response: DataQueryResponse) => {
    return of({
      ...response,
      data: response.data.map((df) => {
        return {
          ...df,
          meta: {
            ...df.meta,
            custom: {
              ...df.meta.custom,
              logsVolumeSourceUid: uid,
              logsVolumeSource: title,
            },
          },
        };
      }),
    });
  });
};

export const getSupplementaryQueryProvider = (
  datasourceInstance: DataSourceApi,
  type: SupplementaryQueryType,
  request: DataQueryRequest,
  explorePanelData: Observable<ExplorePanelData>
): Observable<DataQueryResponse> | undefined => {
  if (hasSupplementaryQuerySupport(datasourceInstance, type)) {
    return datasourceInstance.getDataProvider(type, request);
  } else if (
    datasourceInstance.meta.mixed === true &&
    datasourceInstance instanceof MixedDatasource &&
    type === SupplementaryQueryType.LogsVolume
  ) {
    // Remove any invalid queries
    const queries = request.targets.filter((t) => {
      return t.datasource?.uid !== MIXED_DATASOURCE_NAME;
    });
    // Build groups of queries to run in parallel
    const sets: { [key: string]: DataQuery[] } = groupBy(queries, 'datasource.uid');
    const mixed: BatchedQueries[] = [];

    for (const key in sets) {
      const targets = sets[key];
      mixed.push({
        datasource: getDataSourceSrv().get(targets[0].datasource, request.scopedVars),
        targets,
      });
    }

    return from(mixed).pipe(
      mergeMap((query, i) => {
        return from(query.datasource).pipe(
          mergeMap((ds) => {
            const dsRequest = cloneDeep(request);
            dsRequest.requestId = `mixed-${type}-${i}-${dsRequest.requestId || ''}`;
            dsRequest.targets = query.targets;
            if (hasSupplementaryQuerySupport(ds, type)) {
              const provider = ds.getDataProvider(type, dsRequest);
              if (provider) {
                return provider.pipe(enrichWithLogsVolumeSource(ds.uid, ds.name + ' (full range)'));
              }
              return of({
                data: [],
                state: LoadingState.Done,
              });
            }
            return createFallbackLogVolumeProvider(explorePanelData).pipe(enrichWithLogsVolumeSource('', 'Shown logs'));
          })
        );
      }),
      scan<DataQueryResponse, DataQueryResponse>(
        (acc, next, i) => {
          if (next.state !== LoadingState.Done) {
            return acc;
          }

          if (next.data[0]?.meta?.custom?.logsVolumeType === LogsVolumeType.Limited) {
            acc.data = acc.data.filter(
              (dataframe) => dataframe.meta?.custom?.logsVolumeType !== LogsVolumeType.Limited
            );
          }

          return {
            ...acc,
            data: [...acc.data, ...next.data],
            state: LoadingState.Done,
          };
        },
        { data: [], state: LoadingState.Loading }
      )
    );
  } else if (type === SupplementaryQueryType.LogsVolume) {
    // Create a fallback to results based logs volume
    return createFallbackLogVolumeProvider(explorePanelData);
  }
  return undefined;
};

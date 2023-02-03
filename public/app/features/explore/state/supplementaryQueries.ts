import { cloneDeep, groupBy } from 'lodash';
import { from, mergeMap, Observable, of } from 'rxjs';
import { scan } from 'rxjs/operators';

import {
  DataFrame,
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
import { BatchedQueries, MIXED_DATASOURCE_NAME, MixedDatasource } from 'app/plugins/datasource/mixed/MixedDataSource';
import { ExplorePanelData } from 'app/types';

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
  }).pipe(enrichWithSource('', 'All visible logs'));
};

const getSupplementaryQueryFallback = (
  type: SupplementaryQueryType,
  explorePanelData: Observable<ExplorePanelData>
) => {
  if (type === SupplementaryQueryType.LogsVolume) {
    return createFallbackLogVolumeProvider(explorePanelData);
  } else {
    return of({
      data: [],
      state: LoadingState.NotStarted,
    });
  }
};

const enrichWithSource = (uid: string, title: string) => {
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
              mixedDataSourceUid: uid,
              mixedDataSourceName: title,
            },
          },
        };
      }),
    });
  });
};

const supplementaryQueryFallbackCleanUp = (type: SupplementaryQueryType, acc: DataFrame[], next: DataQueryResponse) => {
  if (
    type === SupplementaryQueryType.LogsVolume &&
    next.data[0]?.meta?.custom?.logsVolumeType === LogsVolumeType.Limited
  ) {
    return acc.filter((dataframe) => dataframe.meta?.custom?.logsVolumeType !== LogsVolumeType.Limited);
  } else {
    return acc;
  }
};

export const getSupplementaryQueryProvider = (
  datasourceInstance: DataSourceApi,
  type: SupplementaryQueryType,
  request: DataQueryRequest,
  explorePanelData: Observable<ExplorePanelData>
): Observable<DataQueryResponse> | undefined => {
  if (hasSupplementaryQuerySupport(datasourceInstance, type)) {
    return datasourceInstance.getDataProvider(type, request);
  } else if (datasourceInstance.meta.mixed === true && datasourceInstance instanceof MixedDatasource) {
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
              const dsProvider = ds.getDataProvider(type, dsRequest);
              if (dsProvider) {
                // 1) It provides data for current request -> use the provider
                return dsProvider.pipe(enrichWithSource(ds.uid, ds.name));
              } else {
                // 2) It doesn't provide data for current request -> return nothing
                return of({
                  data: [],
                  state: LoadingState.NotStarted,
                });
              }
            } else {
              // 3) Data source doesn't support the supplementary query -> use fallback
              // the fallback cannot determine data availability based on request, it
              // works on the results once they are available
              return getSupplementaryQueryFallback(type, explorePanelData);
            }
          })
        );
      }),
      scan<DataQueryResponse, DataQueryResponse>(
        (acc, next, i) => {
          if (next.state !== LoadingState.Done) {
            return acc;
          }

          acc.data = supplementaryQueryFallbackCleanUp(type, acc.data, next);

          return {
            ...acc,
            data: [...acc.data, ...next.data],
            state: LoadingState.Done,
          };
        },
        { data: [], state: LoadingState.NotStarted }
      )
    );
  } else if (type === SupplementaryQueryType.LogsVolume) {
    // Create a fallback to results based logs volume
    return createFallbackLogVolumeProvider(explorePanelData);
  }
  return undefined;
};

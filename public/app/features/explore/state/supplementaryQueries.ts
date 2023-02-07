import { cloneDeep, filter, groupBy, head } from 'lodash';
import { from, mergeMap, Observable, of } from 'rxjs';
import { scan } from 'rxjs/operators';

import {
  AbsoluteTimeRange,
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

/**
 * Adds extra information to the data frame to indicate what data source it originated from.
 * This can be used by visualizations to split data frames by source (but visualization can
 * also decide to merge all results in a single view).
 */
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
              datasourceUid: uid,
              datasourceName: title,
            },
          },
        };
      }),
    });
  });
};

/**
 * Cleans-up duplicated results. In case multiple data sources do not support logs volume histograms, ensures there's
 * only one result coming from the fallback.
 *
 * Note: The code seems simpler this way though it's less performant. In case of performance issues caused by processing
 * too many log lines in the fallback multiple times this can be optimised to create only one fallback all the time.
 */
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

/**
 * CacheInfo contains previous results. If queries didn't change and previous results cover wider time range,
 * the previous results are used and returned straight away.
 */
const getCachedResults = (cacheInfo: SupplementaryQueryCacheInfo, uid: string) => {
  const prev = filter(cacheInfo.previousData, ['meta.custom.datasourceUid', uid]);
  const frame = head(prev);
  if (frame) {
    const dataRange = frame.meta?.custom?.absoluteRange;
    const hasWiderRange =
      dataRange && dataRange.from <= cacheInfo.newRange.from && cacheInfo.newRange.to <= dataRange.to;
    if (hasWiderRange) {
      return of({ state: LoadingState.Done, data: prev });
    }
  }
  return undefined;
};

/**
 * Used for reusing the existing data if possible
 */
type SupplementaryQueryCacheInfo = {
  previousData: DataFrame[];
  newQueries: DataQuery[];
  newRange: AbsoluteTimeRange;
};

export const getSupplementaryQueryProvider = (
  datasourceInstance: DataSourceApi,
  type: SupplementaryQueryType,
  request: DataQueryRequest,
  explorePanelData: Observable<ExplorePanelData>,
  cacheInfo: SupplementaryQueryCacheInfo
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
                const cached = getCachedResults(cacheInfo, ds.uid);
                // 1) It provides data for current request -> use cached results or 2) get fresh data
                return cached || dsProvider.pipe(enrichWithSource(ds.uid, ds.name));
              } else {
                // 3) It doesn't provide data for current request -> return nothing
                return of({
                  data: [],
                  state: LoadingState.NotStarted,
                });
              }
            } else {
              // 4) Data source doesn't support the supplementary query -> use fallback
              // the fallback cannot determine data availability based on request, it
              // works on the results once they are available so it never uses the cache
              return getSupplementaryQueryFallback(type, explorePanelData);
            }
          })
        );
      }),
      scan<DataQueryResponse, DataQueryResponse>(
        (acc, next) => {
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

import { cloneDeep, groupBy } from 'lodash';
import { distinct, from, mergeMap, Observable, of } from 'rxjs';
import { scan } from 'rxjs/operators';

import {
  DataFrame,
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  hasSupplementaryQuerySupport,
  LoadingState,
  LogsVolumeCustomMetaData,
  LogsVolumeType,
  SupplementaryQueryType,
} from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { makeDataFramesForLogs } from 'app/core/logsModel';
import store from 'app/core/store';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';
import { ExplorePanelData, SupplementaryQueries } from 'app/types';

export const supplementaryQueryTypes: SupplementaryQueryType[] = [
  SupplementaryQueryType.LogsVolume,
  SupplementaryQueryType.LogsSample,
];

const getSupplementaryQuerySettingKey = (type: SupplementaryQueryType) => `grafana.explore.logs.enable${type}`;

export const storeSupplementaryQueryEnabled = (enabled: boolean, type: SupplementaryQueryType): void => {
  store.set(getSupplementaryQuerySettingKey(type), enabled ? 'true' : 'false');
};

export const loadSupplementaryQueries = (): SupplementaryQueries => {
  // We default to true for all supp queries
  let supplementaryQueries: SupplementaryQueries = {
    [SupplementaryQueryType.LogsVolume]: { enabled: true },
    [SupplementaryQueryType.LogsSample]: { enabled: false },
  };

  for (const type of supplementaryQueryTypes) {
    if (type === SupplementaryQueryType.LogsVolume) {
      // TODO: Remove this in 10.0 (#61626)
      // For LogsVolume we need to migrate old key to new key. So check for old key:
      // If we have old key: 1) use it 2) migrate to new key 3) delete old key
      // If not, continue with new key
      const oldLogsVolumeEnabledKey = 'grafana.explore.logs.enableVolumeHistogram';
      const shouldBeEnabled = store.get(oldLogsVolumeEnabledKey);
      if (shouldBeEnabled) {
        supplementaryQueries[type] = { enabled: shouldBeEnabled === 'true' ? true : false };
        storeSupplementaryQueryEnabled(shouldBeEnabled === 'true', SupplementaryQueryType.LogsVolume);
        localStorage.removeItem(oldLogsVolumeEnabledKey);
        continue;
      }
    }

    // We want to skip LogsSample and default it to false for now to trigger it only on user action
    if (type === SupplementaryQueryType.LogsSample) {
      continue;
    }

    // Only if "false" value in local storage, we disable it
    const shouldBeEnabled = store.get(getSupplementaryQuerySettingKey(type));
    if (shouldBeEnabled === 'false') {
      supplementaryQueries[type] = { enabled: false };
    }
  }
  return supplementaryQueries;
};

const createFallbackLogVolumeProvider = (
  explorePanelData: Observable<ExplorePanelData>,
  queryTargets: DataQuery[],
  datasourceName: string
): Observable<DataQueryResponse> => {
  return new Observable<DataQueryResponse>((observer) => {
    explorePanelData.subscribe((exploreData) => {
      if (
        exploreData.logsResult &&
        exploreData.logsResult.rows &&
        exploreData.logsResult.visibleRange &&
        exploreData.logsResult.bucketSize !== undefined &&
        exploreData.state === LoadingState.Done
      ) {
        const bucketSize = exploreData.logsResult.bucketSize;
        const targetRefIds = queryTargets.map((query) => query.refId);
        const rowsByRefId = groupBy(exploreData.logsResult.rows, 'dataFrame.refId');
        let allSeries: DataFrame[] = [];
        targetRefIds.forEach((refId) => {
          if (rowsByRefId[refId]?.length) {
            const series = makeDataFramesForLogs(rowsByRefId[refId], bucketSize);
            allSeries = [...allSeries, ...series];
            const logVolumeCustomMetaData: LogsVolumeCustomMetaData = {
              logsVolumeType: LogsVolumeType.Limited,
              absoluteRange: exploreData.logsResult?.visibleRange!,
              datasourceName,
              sourceQuery: queryTargets.find((query) => query.refId === refId)!,
              reuseWhenZoomingIn: false,
            };

            observer.next({
              data: allSeries.map((d) => {
                const custom = d.meta?.custom || {};
                return {
                  ...d,
                  meta: {
                    custom: {
                      ...custom,
                      ...logVolumeCustomMetaData,
                    },
                  },
                };
              }),
              state: exploreData.state,
            });
          }
        });
        observer.complete();
      }
    });
  });
};

const getSupplementaryQueryFallback = (
  type: SupplementaryQueryType,
  explorePanelData: Observable<ExplorePanelData>,
  queryTargets: DataQuery[],
  datasourceName: string
) => {
  if (type === SupplementaryQueryType.LogsVolume) {
    return createFallbackLogVolumeProvider(explorePanelData, queryTargets, datasourceName);
  } else {
    return of({
      data: [],
      state: LoadingState.NotStarted,
    });
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
  } else if (datasourceInstance.meta?.mixed === true) {
    const queries = request.targets.filter((t) => {
      return t.datasource?.uid !== MIXED_DATASOURCE_NAME;
    });
    // Build groups of queries to run in parallel
    const sets: { [key: string]: DataQuery[] } = groupBy(queries, 'datasource.uid');
    const mixed: Array<{ datasource: Promise<DataSourceApi>; targets: DataQuery[] }> = [];

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
                // 1) It provides data for current request - use the provider
                return dsProvider;
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
              // works on the results once they are available so it never uses the cache
              return getSupplementaryQueryFallback(type, explorePanelData, query.targets, ds.name);
            }
          })
        );
      }),
      scan<DataQueryResponse, DataQueryResponse>(
        (acc, next) => {
          if (acc.error || next.state === LoadingState.NotStarted) {
            return acc;
          }

          if (next.state === LoadingState.Loading && acc.state === LoadingState.NotStarted) {
            return {
              ...acc,
              state: LoadingState.Loading,
            };
          }

          if (next.state && next.state !== LoadingState.Done) {
            return acc;
          }

          return {
            ...acc,
            data: [...acc.data, ...next.data],
            state: LoadingState.Done,
          };
        },
        { data: [], state: LoadingState.NotStarted }
      ),
      distinct()
    );
  } else if (type === SupplementaryQueryType.LogsSample) {
    return undefined;
  } else {
    // Create a fallback to results based logs volume
    return getSupplementaryQueryFallback(type, explorePanelData, request.targets, datasourceInstance.name);
  }
  return undefined;
};

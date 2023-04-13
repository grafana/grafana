import { cloneDeep, groupBy } from 'lodash';
import { distinct, Observable, merge } from 'rxjs';
import { scan } from 'rxjs/operators';

import {
  DataFrame,
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  hasSupplementaryQuerySupport,
  isTruthy,
  LoadingState,
  LogsVolumeCustomMetaData,
  LogsVolumeType,
  SupplementaryQueryType,
} from '@grafana/data';
import { makeDataFramesForLogs } from 'app/core/logsModel';
import store from 'app/core/store';
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
    return undefined;
  }
};

export const getSupplementaryQueryProvider = (
  groupedQueries: Array<{ datasource: DataSourceApi; targets: DataQuery[] }>,
  type: SupplementaryQueryType,
  request: DataQueryRequest,
  explorePanelData: Observable<ExplorePanelData>
): Observable<DataQueryResponse> | undefined => {
  const providers = groupedQueries.map(({ datasource, targets }, i) => {
    const dsRequest = cloneDeep(request);
    dsRequest.requestId = `${dsRequest.requestId || ''}_${i}`;
    dsRequest.targets = targets;

    if (hasSupplementaryQuerySupport(datasource, type)) {
      return datasource.getDataProvider(type, dsRequest);
    } else {
      return getSupplementaryQueryFallback(type, explorePanelData, targets, datasource.name);
    }
  });

  const definedProviders = providers.filter(isTruthy);

  if (definedProviders.length === 0) {
    return undefined;
  } else if (definedProviders.length === 1) {
    return definedProviders[0];
  }

  return merge(...definedProviders).pipe(
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
};

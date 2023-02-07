import { Observable } from 'rxjs';

import {
  DataSourceApi,
  SupplementaryQueryType,
  DataQueryResponse,
  hasSupplementaryQuerySupport,
  DataQueryRequest,
  LoadingState,
  LogsVolumeType,
} from '@grafana/data';

import { ExplorePanelData } from '../../../types';

export const getSupplementaryQueryProvider = (
  datasourceInstance: DataSourceApi,
  type: SupplementaryQueryType,
  request: DataQueryRequest,
  explorePanelData: Observable<ExplorePanelData>
): Observable<DataQueryResponse> | undefined => {
  if (hasSupplementaryQuerySupport(datasourceInstance, type)) {
    return datasourceInstance.getDataProvider(type, request);
  } else if (type === SupplementaryQueryType.LogsVolume) {
    // Create a fallback to results based logs volume
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
  }
  return undefined;
};

import { Observable } from 'rxjs';

import {
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  hasLogsSampleSupport,
  hasLogsVolumeSupport,
} from '@grafana/data';
import store from 'app/core/store';
import { SupplementaryQueries, SupplementaryQueryType } from 'app/types';

export const supplementaryQueriesList: Array<{
  getProviderFunc: (
    datasource: unknown
  ) => ((request: DataQueryRequest<DataQuery>) => Observable<DataQueryResponse> | undefined) | undefined;
  requestId: string;
  type: SupplementaryQueryType;
}> = [
  {
    type: SupplementaryQueryType.LogsVolume,
    getProviderFunc: getLogsVolumeDataProvider,
    requestId: '_log_volume',
  },
  {
    type: SupplementaryQueryType.LogsSample,
    getProviderFunc: getLogsSamplesDataProvider,
    requestId: '_log_sample',
  },
];

export function getLogsSamplesDataProvider(datasource: unknown) {
  if (hasLogsSampleSupport(datasource)) {
    return datasource.getLogsSampleDataProvider;
  }
  return undefined;
}

export function getLogsVolumeDataProvider(datasource: unknown) {
  if (hasLogsVolumeSupport(datasource)) {
    return datasource.getLogsVolumeDataProvider;
  }
  return undefined;
}

const getSupplementaryQuerySettingKey = (type: SupplementaryQueryType) => `grafana.explore.logs.enable${type}`;

export const storeSupplementaryQueryEnabled = (enabled: boolean, type: SupplementaryQueryType): void => {
  store.set(getSupplementaryQuerySettingKey(type), enabled ? 'true' : 'false');
};

export const loadSupplementaryQueries = (): SupplementaryQueries => {
  // We default to true for all supp queries
  let supplementaryQueries: SupplementaryQueries = {
    [SupplementaryQueryType.LogsVolume]: { enabled: true },
    // This is set to false temporarily, until we have UI to display logs sample and a way how to enable/disable it
    [SupplementaryQueryType.LogsSample]: { enabled: true },
  };

  for (const { type } of Object.values(supplementaryQueriesList)) {
    // Only if "false" value in local storage, we disable it
    if (store.get(getSupplementaryQuerySettingKey(type)) === 'false') {
      supplementaryQueries[type] = { enabled: false };
    }
  }
  return supplementaryQueries;
};

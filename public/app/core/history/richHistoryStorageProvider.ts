import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';

import { SortOrder } from '../utils/richHistoryTypes';

import RichHistoryAppPlatformStorage from './RichHistoryAppPlatformStorage';
import RichHistoryLocalStorage from './RichHistoryLocalStorage';
import RichHistoryRemoteStorage from './RichHistoryRemoteStorage';
import RichHistoryStorage from './RichHistoryStorage';

const richHistoryLocalStorage = new RichHistoryLocalStorage();
const richHistoryRemoteStorage = new RichHistoryRemoteStorage();
const richHistoryAppPlatformStorage = new RichHistoryAppPlatformStorage();

// for query history operations
export const getRichHistoryStorage = (): RichHistoryStorage => {
  if (!config.queryHistoryEnabled) {
    return richHistoryLocalStorage;
  }

  // Use App Platform storage when the Kubernetes flag is enabled
  if (config.featureToggles?.kubernetesQueryHistory) {
    return richHistoryAppPlatformStorage;
  }

  return richHistoryRemoteStorage;
};

// for autocomplete read and write operations
export const getLocalRichHistoryStorage = (): RichHistoryStorage => {
  return richHistoryLocalStorage;
};

interface RichHistorySupportedFeatures {
  availableFilters: SortOrder[];
  lastUsedDataSourcesAvailable: boolean;
  clearHistory: boolean;
  onlyActiveDataSource: boolean;
  changeRetention: boolean;
  queryHistoryAvailable: boolean;
}

export const supportedFeatures = (): RichHistorySupportedFeatures => {
  return config.queryHistoryEnabled
    ? {
        availableFilters: [SortOrder.Descending, SortOrder.Ascending],
        lastUsedDataSourcesAvailable: false,
        clearHistory: false,
        onlyActiveDataSource: false,
        changeRetention: false,
        queryHistoryAvailable: contextSrv.isSignedIn,
      }
    : {
        availableFilters: [SortOrder.Descending, SortOrder.Ascending, SortOrder.DatasourceAZ, SortOrder.DatasourceZA],
        lastUsedDataSourcesAvailable: true,
        clearHistory: true,
        onlyActiveDataSource: true,
        changeRetention: true,
        queryHistoryAvailable: true,
      };
};

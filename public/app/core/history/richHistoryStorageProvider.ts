import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';

import { SortOrder } from '../utils/richHistoryTypes';

import RichHistoryLocalStorage from './RichHistoryLocalStorage';
import RichHistoryRemoteStorage from './RichHistoryRemoteStorage';
import RichHistoryStorage from './RichHistoryStorage';

const richHistoryLocalStorage = new RichHistoryLocalStorage();
const richHistoryRemoteStorage = new RichHistoryRemoteStorage();

// for query history operations
export const getRichHistoryStorage = (): RichHistoryStorage => {
  return config.queryHistoryEnabled ? richHistoryRemoteStorage : richHistoryLocalStorage;
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

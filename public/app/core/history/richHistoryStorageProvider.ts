import { config, reportInteraction } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';

import { SortOrder } from '../utils/richHistoryTypes';

import RichHistoryIndexedDBStorage from './RichHistoryIndexedDBStorage';
import RichHistoryLocalStorage from './RichHistoryLocalStorage';
import RichHistoryRemoteStorage from './RichHistoryRemoteStorage';
import type RichHistoryStorage from './RichHistoryStorage';

const richHistoryLocalStorage = new RichHistoryLocalStorage();
const richHistoryRemoteStorage = new RichHistoryRemoteStorage();

let richHistoryIndexedDBStorage: RichHistoryIndexedDBStorage | undefined;
const getRichHistoryIndexedDBStorage = (): RichHistoryStorage => {
  if (typeof indexedDB === 'undefined') {
    reportInteraction('grafana_query_history_indexeddb_unavailable', { fallback: 'localStorage' });
    return richHistoryLocalStorage;
  }
  if (!richHistoryIndexedDBStorage) {
    richHistoryIndexedDBStorage = new RichHistoryIndexedDBStorage();
  }
  return richHistoryIndexedDBStorage;
};

// for query history operations
export const getRichHistoryStorage = (): RichHistoryStorage => {
  if (config.featureToggles?.queryHistoryLocalOnly) {
    return getRichHistoryIndexedDBStorage();
  }
  return config.queryHistoryEnabled ? richHistoryRemoteStorage : richHistoryLocalStorage;
};

// for autocomplete read and write operations
export const getLocalRichHistoryStorage = (): RichHistoryStorage => {
  if (config.featureToggles?.queryHistoryLocalOnly) {
    return getRichHistoryIndexedDBStorage();
  }
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
  if (config.featureToggles?.queryHistoryLocalOnly) {
    return {
      availableFilters: [SortOrder.Descending, SortOrder.Ascending, SortOrder.DatasourceAZ, SortOrder.DatasourceZA],
      lastUsedDataSourcesAvailable: true,
      clearHistory: true,
      onlyActiveDataSource: true,
      changeRetention: true,
      queryHistoryAvailable: true,
    };
  }
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

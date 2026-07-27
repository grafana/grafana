import { config, reportInteraction } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { createWarningNotification } from 'app/core/copy/appNotification';
import { contextSrv } from 'app/core/services/context_srv';
import { dispatch } from 'app/store/store';

import { notifyApp } from '../reducers/appNotification';
import { SortOrder } from '../utils/richHistoryTypes';

import RichHistoryIndexedDBStorage from './RichHistoryIndexedDBStorage';
import RichHistoryLocalStorage from './RichHistoryLocalStorage';
import RichHistoryRemoteStorage from './RichHistoryRemoteStorage';
import type RichHistoryStorage from './RichHistoryStorage';

const richHistoryLocalStorage = new RichHistoryLocalStorage();
const richHistoryRemoteStorage = new RichHistoryRemoteStorage();

let richHistoryIndexedDBStorage: RichHistoryIndexedDBStorage | undefined;
let indexedDBWarningShown = false;
const getRichHistoryIndexedDBStorage = (): RichHistoryStorage => {
  if (typeof indexedDB === 'undefined') {
    if (!indexedDBWarningShown) {
      indexedDBWarningShown = true;
      reportInteraction('grafana_query_history_indexeddb_unavailable', { fallback: 'localStorage' });
      dispatch(
        notifyApp(
          createWarningNotification(
            'Query history: IndexedDB is unavailable',
            'Falling back to localStorage. Some features may be limited.'
          )
        )
      );
    }
    return richHistoryLocalStorage;
  }
  if (!richHistoryIndexedDBStorage) {
    richHistoryIndexedDBStorage = new RichHistoryIndexedDBStorage();
  }
  return richHistoryIndexedDBStorage;
};

/**
 * Returns the appropriate storage backend for query history operations.
 *
 * Note: When `queryHistory.localOnly` is toggled off after IndexedDB use, history written
 * to IndexedDB remains on disk but is no longer read. localStorage history is preserved
 * during migration (it is the rollback path), so the user falls back to their
 * pre-migration localStorage content rather than an empty history.
 */
export const getRichHistoryStorage = (): RichHistoryStorage => {
  if (getFeatureFlagClient().getBooleanValue(FlagKeys.QueryHistoryLocalOnly, false)) {
    return getRichHistoryIndexedDBStorage();
  }
  return config.queryHistoryEnabled ? richHistoryRemoteStorage : richHistoryLocalStorage;
};

// for autocomplete read and write operations
export const getLocalRichHistoryStorage = (): RichHistoryStorage => {
  if (getFeatureFlagClient().getBooleanValue(FlagKeys.QueryHistoryLocalOnly, false)) {
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
  if (getFeatureFlagClient().getBooleanValue(FlagKeys.QueryHistoryLocalOnly, false)) {
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

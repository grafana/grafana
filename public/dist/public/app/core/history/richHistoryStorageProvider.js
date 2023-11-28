import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';
import { SortOrder } from '../utils/richHistoryTypes';
import RichHistoryLocalStorage from './RichHistoryLocalStorage';
import RichHistoryRemoteStorage from './RichHistoryRemoteStorage';
const richHistoryLocalStorage = new RichHistoryLocalStorage();
const richHistoryRemoteStorage = new RichHistoryRemoteStorage();
export const getRichHistoryStorage = () => {
    return config.queryHistoryEnabled ? richHistoryRemoteStorage : richHistoryLocalStorage;
};
export const supportedFeatures = () => {
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
//# sourceMappingURL=richHistoryStorageProvider.js.map
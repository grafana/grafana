import RichHistoryLocalStorage from './RichHistoryLocalStorage';
import RichHistoryStorage from './RichHistoryStorage';
import RichHistoryRemoteStorage from './RichHistoryRemoteStorage';
import { config } from '@grafana/runtime';
import { SortOrder } from '../utils/richHistoryTypes';

const richHistoryLocalStorage = new RichHistoryLocalStorage();
const richHistoryRemoteStorage = new RichHistoryRemoteStorage();

export const getRichHistoryStorage = (): RichHistoryStorage => {
  return config.featureToggles.newQueryHistory ? richHistoryRemoteStorage : richHistoryLocalStorage;
};

interface RichHistorySupportedFeatures {
  availableFilters: SortOrder[];
  lastUsedDataSourcesAvailable: boolean;
}

export const supportedFeatures = (): RichHistorySupportedFeatures => {
  return config.featureToggles.newQueryHistory
    ? {
        availableFilters: [SortOrder.Descending, SortOrder.Ascending],
        lastUsedDataSourcesAvailable: false,
      }
    : {
        availableFilters: [SortOrder.Descending, SortOrder.Ascending, SortOrder.DatasourceAZ, SortOrder.DatasourceZA],
        lastUsedDataSourcesAvailable: true,
      };
};

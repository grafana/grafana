import RichHistoryLocalStorage from './RichHistoryLocalStorage';
import RichHistoryStorage from './RichHistoryStorage';
import RichHistoryRemoteStorage from './RichHistoryRemoteStorage';
import { config } from '@grafana/runtime';

const richHistoryLocalStorage = new RichHistoryLocalStorage();
const richHistoryRemoteStorage = new RichHistoryRemoteStorage();

export const getRichHistoryStorage = (): RichHistoryStorage => {
  return config.featureToggles.newQueryHistory ? richHistoryRemoteStorage : richHistoryLocalStorage;
};

import { config } from '@grafana/runtime';

import RichHistoryLocalStorage from './richHistoryLocalStorage';
import RichHistoryRemoteStorage from './richHistoryRemoteStorage';
import RichHistoryStorage from './richHistoryStorage';

const richHistoryLocalStorageService = new RichHistoryLocalStorage();
const richHistoryBackendService = new RichHistoryRemoteStorage();

export const getRichHistoryService = (): RichHistoryStorage => {
  return config.featureToggles.newRichHistory ? richHistoryBackendService : richHistoryLocalStorageService;
};

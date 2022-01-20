import { config } from '@grafana/runtime';

import RichHistoryLocalStorageService from './richHistoryLocalStorageService';
import RichHistoryBackendService from './richHistoryBackendService';
import RichHistoryService from './richHistoryService';

const richHistoryLocalStorageService = new RichHistoryLocalStorageService();
const richHistoryBackendService = new RichHistoryBackendService();

export const getRichHistoryService = (): RichHistoryService => {
  if (config.featureToggles.newRichHistory) {
    console.info('Using new rich history');
    return richHistoryBackendService;
  } else {
    console.info('Using old rich history');
    return richHistoryLocalStorageService;
  }
};

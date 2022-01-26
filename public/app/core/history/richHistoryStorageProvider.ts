import RichHistoryLocalStorage from './richHistoryLocalStorage';
import RichHistoryRemoteStorage from './richHistoryRemoteStorage';
import RichHistoryStorage from './richHistoryStorage';

const richHistoryLocalStorage = new RichHistoryLocalStorage();

// To be implemented and switched with a feature flag.
// @ts-ignore
const richHistoryRemoteStorage = new RichHistoryRemoteStorage();

export const getRichHistoryStorage = (): RichHistoryStorage => {
  return richHistoryLocalStorage;
};

import RichHistoryLocalStorage from './RichHistoryLocalStorage';
import RichHistoryRemoteStorage from './RichHistoryRemoteStorage';
import RichHistoryStorage from './RichHistoryStorage';

const richHistoryLocalStorage = new RichHistoryLocalStorage();

// To be implemented and switched with a feature flag.
// @ts-ignore
const richHistoryRemoteStorage = new RichHistoryRemoteStorage();

export const getRichHistoryStorage = (): RichHistoryStorage => {
  return richHistoryLocalStorage;
};

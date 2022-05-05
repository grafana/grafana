import RichHistoryLocalStorage from './RichHistoryLocalStorage';
import RichHistoryStorage from './RichHistoryStorage';

const richHistoryLocalStorage = new RichHistoryLocalStorage();

export const getRichHistoryStorage = (): RichHistoryStorage => {
  return richHistoryLocalStorage;
};

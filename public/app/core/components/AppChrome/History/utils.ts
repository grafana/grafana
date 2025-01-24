import { HistoryEntry } from '../types';

export const getEntryPath = (url: string) => url.substring(0, url.indexOf('?') !== -1 ? url.indexOf('?') : undefined);
export const getEntryQueryParams = (url: string) =>
  url.indexOf('?') !== -1 ? url.substring(url.indexOf('?')) : undefined;

export const hackyFixes = (newEntry: HistoryEntry, entries: HistoryEntry[]): HistoryEntry[] => {
  const existingEntry = entries[0];
  const existingUrlPath = existingEntry && getEntryPath(existingEntry.url);
  const existingUrlQueryParams = existingEntry && getEntryQueryParams(existingEntry.url);
  const existingUrlTitle = existingEntry && existingEntry.name;
  const newUrlPath = getEntryPath(newEntry.url);
  const newUrlQueryParams = getEntryQueryParams(newEntry.url);
  const newUrlTitle = newEntry.name;

  // Explore page without query params should return the entries without the new entry
  if (newUrlPath.endsWith('/explore') && !newUrlQueryParams) {
    entries = entries;
  } else if (newUrlPath.endsWith('/explore') && newUrlQueryParams && newUrlTitle === 'Explore') {
    // Explore page with query params called 'Explore' shouldn't be added to the history
    entries = entries;
  } else if (
    newUrlPath.endsWith('/explore') &&
    existingEntry &&
    existingUrlQueryParams &&
    newUrlTitle === existingUrlTitle &&
    newUrlQueryParams !== existingUrlQueryParams
  ) {
    // Explore page with query params but different than the previous one while having the same title shouldn't be added to the history
    entries = entries;
  } else if (newUrlPath.includes('\/d\/') && newUrlTitle === 'Dashboards') {
    // Dashboard page called 'Dashboards' won't be added to the history as it is the Browse Dashboard page
    entries = entries;
  } else if (newUrlPath.includes('\/d\/') && existingEntry && existingUrlPath === newUrlPath) {
    entries = entries;
    // If the new entry does not have a name we avoid adding this to the history
    // This is what happens to Frotend page that gets redirected and creates a 'Home > Frontend >' entry
  } else if (newUrlTitle === '') {
    entries = entries;
  } else {
    entries = [newEntry, ...entries];
  }
  return entries;
};

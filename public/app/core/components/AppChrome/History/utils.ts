import { HistoryEntry } from '../types';

export const getEntryPath = (url: string) => url.substring(0, url.indexOf('?') !== -1 ? url.indexOf('?') : undefined);
export const getEntryQueryParams = (url: string) =>
  url.indexOf('?') !== -1 ? url.substring(url.indexOf('?')) : undefined;

export const hackyFixes = (newEntry: HistoryEntry, entries: HistoryEntry[]): HistoryEntry[] => {
  const existingEntry = entries[0];
  const existingUrlPath = existingEntry && getEntryPath(existingEntry.url);
  const existingUrlQueryParams = existingEntry && getEntryQueryParams(existingEntry.url);
  const newUrlPath = getEntryPath(newEntry.url);
  const newUrlQueryParams = getEntryQueryParams(newEntry.url);
  const newUrlTitle = newEntry.name;

  // Explore page without query params should return the entries without the new entry
  if (newUrlPath.endsWith('/explore') && !newUrlQueryParams) {
    entries = entries;
  } else {
    entries = [newEntry, ...entries];
  }
  return entries;
};

import { HistoryEntry } from '../types';

export const getEntryPath = (url: string) => url.substring(0, url.indexOf('?') !== -1 ? url.indexOf('?') : undefined);
export const getEntryQueryParams = (url: string) =>
  url.indexOf('?') !== -1 ? url.substring(url.indexOf('?')) : undefined;

export const needHackyFixes = (newEntry: HistoryEntry, existingEntry?: HistoryEntry) => {
  let needHackyFixes = false;
  const existingUrlPath = existingEntry && getEntryPath(existingEntry.url);
  const existingUrlQueryParams = existingEntry && getEntryQueryParams(existingEntry.url);
  const newUrlPath = getEntryPath(newEntry.url);
  const newUrlQueryParams = getEntryQueryParams(newEntry.url);
  const newUrlTitle = newEntry.name;

  // Explore cases
  if (newUrlPath.includes('/explore') && !newUrlQueryParams) {
    needHackyFixes = true;
  } else if (
    newEntry.url.includes('/explore?') &&
    newUrlQueryParams &&
    existingUrlQueryParams?.includes(newUrlQueryParams)
  ) {
    needHackyFixes = true;
  }

  // Dashboard cases
  else if (newUrlPath === '/dashboards' && newUrlTitle === 'Dashboards') {
    needHackyFixes = false;
  } else if (
    newUrlPath.includes('\/d\/') &&
    existingUrlPath &&
    newUrlPath.includes(existingUrlPath) &&
    existingUrlPath !== '/dashboards'
  ) {
    needHackyFixes = true;
  }
  // Frontend cases
  else if (newEntry.url === '/a/grafana-kowalski-app') {
    needHackyFixes = true;
  }

  // Dumplicated URL
  else if (existingEntry && newUrlPath === existingUrlPath && newUrlQueryParams === existingUrlQueryParams) {
    needHackyFixes = true;
  }

  return needHackyFixes;
};

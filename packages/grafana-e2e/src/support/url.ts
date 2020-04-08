import { e2e } from '../index';

const getBaseUrl = () => e2e.env('BASE_URL') || e2e.config().baseUrl || 'http://localhost:3000';

export const fromBaseUrl = (url = ''): string => {
  const strippedUrl = url.replace('^/', '');
  return `${getBaseUrl()}${strippedUrl}`;
};

export const getDashboardUid = (url: string): string => {
  const matches = url.match(/\/d\/(.*)\//);
  if (!matches) {
    throw new Error(`Couldn't parse uid from ${url}`);
  } else {
    return matches[1];
  }
};

export const getDataSourceId = (url: string): string => {
  const matches = url.match(/\/edit\/(.*)\//);
  if (!matches) {
    throw new Error(`Couldn't parse id from ${url}`);
  } else {
    return matches[1];
  }
};

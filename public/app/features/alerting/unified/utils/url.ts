import { config } from '@grafana/runtime';

export function createRelativeUrl(
  path: string,
  queryParams?: string[][] | Record<string, string> | string | URLSearchParams
) {
  const searchParams = new URLSearchParams(queryParams);
  const searchParamsString = searchParams.toString();

  return `${config.appSubUrl}${addSlashIfNotPresent(path)}${searchParamsString ? `?${searchParamsString}` : ''}`;
}

function addSlashIfNotPresent(path: string) {
  return path.startsWith('/') ? path : `/${path}`;
}

export function createAbsoluteUrl(
  path: string,
  queryParams?: string[][] | Record<string, string> | string | URLSearchParams
) {
  const searchParams = new URLSearchParams(queryParams);
  const searchParamsString = searchParams.toString();

  try {
    const baseUrl = new URL(config.appSubUrl + addSlashIfNotPresent(path), config.appUrl);
    return `${baseUrl.href}${searchParamsString ? `?${searchParamsString}` : ''}`;
  } catch (err) {
    return createRelativeUrl(path, queryParams);
  }
}

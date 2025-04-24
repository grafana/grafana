import { config } from '@grafana/runtime';

export type RelativeUrl = `/${string}`;

interface CreateRelativeUrlOptions {
  /**
   * If true, the sub path will not be added to the URL
   * If the URL will be used by react-router or history (e.g. locationService.push), you should set this to true because react-router adds the sub path by itself
   */
  skipSubPath?: boolean;
}

export function createRelativeUrl(
  path: RelativeUrl,
  queryParams?: string[][] | Record<string, string> | string | URLSearchParams,
  options: CreateRelativeUrlOptions = { skipSubPath: false }
) {
  const searchParams = new URLSearchParams(queryParams);
  const searchParamsString = searchParams.toString();

  const subPath = options.skipSubPath ? '' : config.appSubUrl;
  return `${subPath}${path}${searchParamsString ? `?${searchParamsString}` : ''}`;
}

export function createAbsoluteUrl(
  path: RelativeUrl,
  queryParams?: string[][] | Record<string, string> | string | URLSearchParams
) {
  const searchParams = new URLSearchParams(queryParams);
  const searchParamsString = searchParams.toString();

  try {
    const baseUrl = new URL(config.appSubUrl + path, config.appUrl);
    return `${baseUrl.href}${searchParamsString ? `?${searchParamsString}` : ''}`;
  } catch (err) {
    return createRelativeUrl(path, queryParams);
  }
}

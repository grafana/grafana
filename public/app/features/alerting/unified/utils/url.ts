import { config } from '@grafana/runtime';

export function createUrl(path: string, queryParams?: string[][] | Record<string, string> | string | URLSearchParams) {
  const searchParams = new URLSearchParams(queryParams);
  const searchParamsString = searchParams.toString();

  return `${config.appSubUrl}${path}${searchParamsString ? `?${searchParamsString}` : ''}`;
}

export function createAbsoluteUrl(
  path: string,
  queryParams?: string[][] | Record<string, string> | string | URLSearchParams
) {
  const searchParams = new URLSearchParams(queryParams);
  const searchParamsString = searchParams.toString();

  try {
    const baseUrl = new URL(config.appSubUrl, config.appUrl);
    baseUrl.pathname = path;

    return `${baseUrl.href}${searchParamsString ? `?${searchParamsString}` : ''}`;
  } catch (err) {
    return createUrl(path, queryParams);
  }
}

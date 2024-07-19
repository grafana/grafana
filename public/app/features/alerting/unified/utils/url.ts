import { config } from '@grafana/runtime';

export function createRelativeUrl(
  path: string,
  queryParams?: string[][] | Record<string, string> | string | URLSearchParams
) {
  const searchParams = new URLSearchParams(queryParams);
  const searchParamsString = searchParams.toString();
  const pathWithSlash = path.startsWith('/') ? path : `/${path}`;

  return `${config.appSubUrl}${pathWithSlash}${searchParamsString ? `?${searchParamsString}` : ''}`;
}

export function createAbsoluteUrl(
  path: string,
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

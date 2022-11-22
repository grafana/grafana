import { config } from '@grafana/runtime';

export function createUrl(path: string, queryParams?: string[][] | Record<string, string> | string | URLSearchParams) {
  const searchParams = new URLSearchParams(queryParams);
  return `${config.appSubUrl}${path}?${searchParams.toString()}`;
}

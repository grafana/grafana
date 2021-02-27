import { createLogger } from '@grafana/ui';

export const navigationLogger = createLogger('Router');

export function queryStringToJSON(queryString: string) {
  const params: Array<[string, string | boolean]> = [];
  new URLSearchParams(queryString).forEach((v, k) => params.push([k, parseValue(v)]));
  return Object.fromEntries(new Map(params));
}

export function parseValue(value: string) {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return value;
}

export function shouldForceReload(query: string) {
  const params = new URLSearchParams(query);
  const forceLoginParam = params.get('forceLogin');

  if (forceLoginParam !== null && parseValue(forceLoginParam)) {
    return true;
  }

  return false;
}

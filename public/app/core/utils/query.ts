import { DataQuery, DataSourceRef } from '@grafana/data';

export const getNextRefIdChar = (queries: DataQuery[]): string => {
  for (let num = 0; ; num++) {
    const refId = getRefId(num);
    if (!queries.some((query) => query.refId === refId)) {
      return refId;
    }
  }
};

export function queryIsEmpty(query: DataQuery): boolean {
  const schema: Record<keyof DataQuery, string> = {
    refId: 'string',
    hide: 'boolean',
    key: 'string',
    queryType: 'string',
    datasource: 'object',
  };

  for (const key in query) {
    if (key === 'label') {
      continue;
    }
    if (!(key in schema)) {
      return false;
    }
  }

  return true;
}

export function addQuery(queries: DataQuery[], query?: Partial<DataQuery>, datasource?: DataSourceRef): DataQuery[] {
  const q = query || {};
  q.refId = getNextRefIdChar(queries);
  q.hide = false;

  if (!q.datasource && datasource) {
    q.datasource = datasource;
  }

  return [...queries, q as DataQuery];
}

export function isDataQuery(url: string): boolean {
  if (url.indexOf('api/datasources/proxy') !== -1 || url.indexOf('api/ds/query') !== -1) {
    return true;
  }

  return false;
}

export function isLocalUrl(url: string) {
  return !url.match(/^http/);
}

function getRefId(num: number): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  if (num < letters.length) {
    return letters[num];
  } else {
    return getRefId(Math.floor(num / letters.length) - 1) + letters[num % letters.length];
  }
}

/**
 * Returns the input value for non empty string and undefined otherwise
 *
 * It is inadvisable to set a query param to an empty string as it will be added to the URL.
 * It is better to keep it undefined so the param won't be added to the URL at all.
 */
export function getQueryParamValue(value: string | undefined | null): string | undefined {
  return value || undefined;
}

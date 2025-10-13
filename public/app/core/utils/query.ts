import { DataQuery, DataSourceRef, getNextRefId } from '@grafana/data';

// This function checks if the query has defined properties beyond those defined in the DataQuery interface.
export function queryIsEmpty(query: DataQuery): boolean {
  const dataQueryProps = ['refId', 'hide', 'key', 'queryType', 'datasource'];

  for (const key in query) {
    // label is not a DataQuery prop, but it's defined in the query when called from the QueryRunner.
    if (key === 'label') {
      continue;
    }
    if (!dataQueryProps.includes(key)) {
      return false;
    }
  }

  return true;
}

export function addQuery(queries: DataQuery[], query?: Partial<DataQuery>, datasource?: DataSourceRef): DataQuery[] {
  const q: DataQuery = {
    ...query,
    refId: getNextRefId(queries),
    hide: false,
  };

  if (!q.datasource && datasource) {
    q.datasource = datasource;
  }

  return [...queries, q];
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

/**
 * Returns the input value for non empty string and undefined otherwise
 *
 * It is inadvisable to set a query param to an empty string as it will be added to the URL.
 * It is better to keep it undefined so the param won't be added to the URL at all.
 */
export function getQueryParamValue(value: string | undefined | null): string | undefined {
  return value || undefined;
}

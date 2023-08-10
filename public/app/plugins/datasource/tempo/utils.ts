import { DataSourceApi, FieldType } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';

import { AdHocVariableFilter, TraceqlFilter, TraceqlSearchScope } from './dataquery.gen';

export const getErrorMessage = (message: string | undefined, prefix?: string) => {
  const err = message ? ` (${message})` : '';
  let errPrefix = prefix ? prefix : 'Error';
  return `${errPrefix}${err}. Please check the server logs for more details.`;
};

export async function getDS(uid?: string): Promise<DataSourceApi | undefined> {
  if (!uid) {
    return undefined;
  }

  const dsSrv = getDataSourceSrv();
  try {
    return await dsSrv.get(uid);
  } catch (error) {
    console.error('Failed to load data source', error);
    return undefined;
  }
}

export function megaToFilters(megaFilters?: AdHocVariableFilter[], megaSpan?: string) {
  const filters: TraceqlFilter[] = [];
  if (megaSpan) {
    filters.push({
      id: 'mega-span',
      tag: 'http.url',
      operator: '=',
      scope: TraceqlSearchScope.Span,
      value: megaSpan,
      valueType: FieldType.string,
    });
  }

  filters.push(
    ...(megaFilters?.map((f, i) => ({
      id: f.key + i,
      tag: f.key,
      operator: f.operator,
      scope: TraceqlSearchScope.Span,
      value: f.value,
      valueType: f.key.includes('.') ? FieldType.string : FieldType.number,
    })) || [])
  );
  return filters;
}

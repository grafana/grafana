import { DataSourceApi } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';

import { generateId } from './SearchTraceQLEditor/TagsInput';
import { SearchTableType, TraceqlFilter, TraceqlSearchScope } from './dataquery.gen';
import { TempoQuery } from './types';

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

export const migrateFromSearchToTraceQLSearch = (query: TempoQuery) => {
  let filters: TraceqlFilter[] = [];
  if (query.spanName) {
    filters.push({
      id: generateId(),
      scope: TraceqlSearchScope.Span,
      tag: 'name',
      operator: '=',
      value: [query.spanName],
      valueType: 'string',
    });
  }
  if (query.serviceName) {
    filters.push({
      id: generateId(),
      scope: TraceqlSearchScope.Resource,
      tag: 'service.name',
      operator: '=',
      value: [query.serviceName],
      valueType: 'string',
    });
  }
  if (query.minDuration) {
    filters.push({
      id: 'min-duration',
      tag: 'duration',
      operator: '>',
      value: [query.minDuration],
      valueType: 'duration',
    });
  }
  if (query.maxDuration) {
    filters.push({
      id: 'max-duration',
      tag: 'duration',
      operator: '<',
      value: [query.maxDuration],
      valueType: 'duration',
    });
  }
  if (query.search) {
    const tags = query.search.split(' ');
    for (const tag of tags) {
      const [key, value] = tag.split('=');
      if (key && value) {
        filters.push({
          id: generateId(),
          scope: TraceqlSearchScope.Unscoped,
          tag: key,
          operator: '=',
          value: [value.replace(/(^"|"$)/g, '')], // remove quotes at start and end of string
          valueType: value.startsWith('"') && value.endsWith('"') ? 'string' : undefined,
        });
      }
    }
  }

  const migreatedQuery: TempoQuery = {
    datasource: query.datasource,
    filters,
    groupBy: query.groupBy,
    limit: query.limit,
    query: query.query,
    queryType: 'traceqlSearch',
    refId: query.refId,
    tableType: SearchTableType.Traces,
  };
  return migreatedQuery;
};

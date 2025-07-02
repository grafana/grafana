import { DataSourceApi, parseDuration } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';

import { generateId } from './SearchTraceQLEditor/TagsInput';
import { TraceqlFilter, TraceqlSearchScope } from './dataquery.gen';
import { TempoQuery } from './types';

const LIMIT_MESSAGE = /.*range specified by start and end.*exceeds.*/;
const LIMIT_MESSAGE_METRICS = /.*metrics query time range exceeds the maximum allowed duration of.*/;

export function mapErrorMessage(errorMessage: string) {
  if (errorMessage && (LIMIT_MESSAGE.test(errorMessage) || LIMIT_MESSAGE_METRICS.test(errorMessage))) {
    return 'The selected time range exceeds the maximum allowed duration. Please select a shorter time range.';
  } else {
    return errorMessage;
  }
}

export const getErrorMessage = (message: string | undefined, prefix?: string) => {
  const err = message ? ` (${message})` : '';
  let errPrefix = prefix ? prefix : 'Error';
  const msg = `${errPrefix}${err}. Please check the server logs for more details.`;
  return mapErrorMessage(msg);
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
      id: 'span-name',
      scope: TraceqlSearchScope.Span,
      tag: 'name',
      operator: '=',
      value: [query.spanName],
      valueType: 'string',
    });
  }
  if (query.serviceName) {
    filters.push({
      id: 'service-name',
      scope: TraceqlSearchScope.Resource,
      tag: 'service.name',
      operator: '=',
      value: [query.serviceName],
      valueType: 'string',
    });
  }
  if (query.minDuration || query.maxDuration) {
    filters.push({
      id: 'duration-type',
      value: 'trace',
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

  const migratedQuery: TempoQuery = {
    datasource: query.datasource,
    filters,
    limit: query.limit,
    query: query.query,
    queryType: 'traceqlSearch',
    refId: query.refId,
  };
  return migratedQuery;
};

export const stepToNanos = (step?: string) => {
  if (!step) {
    return 0;
  }

  const match = step.match(/(\d+)(.+)/);

  const rawLength = match?.[1];
  const unit = match?.[2];

  if (rawLength) {
    if (unit === 'ns') {
      return parseInt(rawLength, 10);
    }
    if (unit === 'µs') {
      return parseInt(rawLength, 10) * 1000;
    }
    if (unit === 'ms') {
      return parseInt(rawLength, 10) * 1000000;
    }
    const duration = parseDuration(step);
    return (
      (duration.seconds || 0) * 1000000000 +
      (duration.minutes || 0) * 60000000000 +
      (duration.hours || 0) * 3600000000000
    );
  }

  return 0;
};

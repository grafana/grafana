import { isEqual } from 'lodash';
import { useState, useRef, useCallback, useMemo } from 'react';
import { useDeepCompareEffect } from 'react-use';

import { getAPINamespace } from '@grafana/api-clients';
import { type AdHocVariableFilter, getDefaultTimeRange, type ScopedVars, type TimeRange } from '@grafana/data';
import { config, getBackendSrv, getDataSourceInstanceSettings } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard/constants';

import { interpolateSourceQueries } from '../../../utils/interpolateSourceQueries';

export function isDashboardDatasource(query: DataQuery): boolean {
  return query.datasource?.uid === SHARED_DASHBOARD_QUERY;
}

export interface SQLSchemaField {
  name: string;
  mysqlType: string;
  dataFrameFieldType: string;
  nullable: boolean;
}

export interface SQLSchemaData {
  columns: SQLSchemaField[] | null;
  sampleRows: Array<Array<string | number | boolean>> | null;
  error?: string;
}

export type SQLSchemas = Record<string, SQLSchemaData>;

export interface SQLSchemasResponse {
  kind: string;
  apiVersion: string;
  sqlSchemas: SQLSchemas;
}

interface UseSQLSchemasOptions {
  queries?: DataQuery[];
  /** The SQL expression's own refId. Its edits don't change source schemas, so they never mark schemas stale. */
  expressionRefId?: string;
  enabled: boolean;
  timeRange?: TimeRange;
  scopedVars?: ScopedVars;
  filters?: AdHocVariableFilter[];
}

export function useSQLSchemas({
  queries,
  expressionRefId,
  enabled,
  timeRange,
  scopedVars,
  filters,
}: UseSQLSchemasOptions) {
  const isFeatureEnabled = useMemo(
    () => config.featureToggles.queryService || config.featureToggles.grafanaAPIServerWithExperimentalAPIs || false,
    []
  );

  // Start with loading=true if we're going to fetch on mount
  const [schemas, setSchemas] = useState<SQLSchemasResponse | null>(null);
  const [loading, setLoading] = useState(enabled && isFeatureEnabled && Boolean(queries));
  const [error, setError] = useState<Error | null>(null);

  // Store queries/scopedVars/filters in refs so we can access current values
  // without triggering the fetch effect on every parent render.
  const queriesRef = useRef(queries);
  queriesRef.current = queries;
  const scopedVarsRef = useRef(scopedVars);
  scopedVarsRef.current = scopedVars;
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // The newest request resolves to its schemas, or null on failure. Older requests are superseded:
  // they skip state updates and resolve to the newest request's result, so no caller sees stale schemas.
  const latestRequestRef = useRef<Promise<SQLSchemasResponse | null>>(Promise.resolve(null));
  const requestedQueriesRef = useRef<DataQuery[] | undefined>(undefined);

  const fetchSchemas = useCallback((): Promise<SQLSchemasResponse | null> => {
    const currentQueries = queriesRef.current;
    if (!enabled || !isFeatureEnabled || !currentQueries) {
      return Promise.resolve(null);
    }

    requestedQueriesRef.current = currentQueries;
    setError(null);

    const nonDashboardQueries = currentQueries.filter((q) => !isDashboardDatasource(q));
    if (nonDashboardQueries.length === 0) {
      const emptySchemas = { kind: 'SQLSchemaResponse', apiVersion: 'query.grafana.app/v0alpha1', sqlSchemas: {} };
      setSchemas(emptySchemas);
      setLoading(false);
      latestRequestRef.current = Promise.resolve(emptySchemas);
      return latestRequestRef.current;
    }

    setLoading(true);
    const request: Promise<SQLSchemasResponse | null> = requestSchemas(
      nonDashboardQueries,
      timeRange,
      scopedVarsRef.current,
      filtersRef.current
    ).then(
      (response) => {
        if (latestRequestRef.current !== request) {
          return latestRequestRef.current;
        }
        setSchemas(response);
        setLoading(false);
        return response;
      },
      (err) => {
        if (latestRequestRef.current !== request) {
          return latestRequestRef.current;
        }
        setError(err instanceof Error ? err : new Error('Failed to fetch SQL schemas'));
        setLoading(false);
        return null;
      }
    );
    latestRequestRef.current = request;
    return request;
  }, [enabled, isFeatureEnabled, timeRange]);

  // `/sqlschemas` executes the source queries, so callers that need current schemas refetch on demand
  // instead of on every source query edit.
  const getCurrentSchemas = useCallback((): Promise<SQLSchemasResponse | null> => {
    const sourceQueries = (qs: DataQuery[] | undefined) => qs?.filter((q) => q.refId !== expressionRefId);
    const isStale = !isEqual(sourceQueries(queriesRef.current), sourceQueries(requestedQueriesRef.current));
    return isStale ? fetchSchemas() : latestRequestRef.current;
  }, [expressionRefId, fetchSchemas]);

  // Refetch on mount, when fetchSchemas identity changes (enabled/feature/timeRange),
  // and when scopedVars/filters change by value. Identity-based comparison would
  // refetch on every parent render that creates new context objects with the same
  // contents; deep comparison avoids that.
  useDeepCompareEffect(() => {
    fetchSchemas();
  }, [fetchSchemas, scopedVars ?? {}, filters ?? []]);

  return { schemas, loading, error, isFeatureEnabled, refetch: fetchSchemas, getCurrentSchemas };
}

async function requestSchemas(
  queries: DataQuery[],
  timeRange: TimeRange | undefined,
  scopedVars: ScopedVars | undefined,
  filters: AdHocVariableFilter[] | undefined
): Promise<SQLSchemasResponse> {
  const defaultDs = await getDataSourceInstanceSettings(null);
  const resolvedQueries = queries.map((query) => {
    if (!query.datasource && defaultDs) {
      return { ...query, datasource: { uid: defaultDs.uid, type: defaultDs.type } };
    }
    return query;
  });

  // Interpolate dashboard variables in source queries so the schema
  // request mirrors what the panel execution path actually sends. Without
  // this, datasources like Prometheus can reject raw `$var` / `$__macro`
  // syntax and datasources like Loki silently return empty data.
  const interpolatedQueries = await interpolateSourceQueries(resolvedQueries, scopedVars ?? {}, filters);

  const namespace = getAPINamespace();
  const currentTimeRange = timeRange || getDefaultTimeRange();

  return getBackendSrv().post<SQLSchemasResponse>(
    `/apis/query.grafana.app/v0alpha1/namespaces/${namespace}/sqlschemas`,
    {
      queries: interpolatedQueries,
      from: currentTimeRange.from.toISOString(),
      to: currentTimeRange.to.toISOString(),
    }
  );
}

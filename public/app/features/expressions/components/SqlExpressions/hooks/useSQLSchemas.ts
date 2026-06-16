import { useState, useRef, useCallback, useMemo } from 'react';
import { useDeepCompareEffect } from 'react-use';

import { getAPINamespace } from '@grafana/api-clients';
import { type AdHocVariableFilter, getDefaultTimeRange, type ScopedVars, type TimeRange } from '@grafana/data';
import { config, getBackendSrv, getDataSourceSrv } from '@grafana/runtime';
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
  enabled: boolean;
  timeRange?: TimeRange;
  scopedVars?: ScopedVars;
  filters?: AdHocVariableFilter[];
}

export function useSQLSchemas({ queries, enabled, timeRange, scopedVars, filters }: UseSQLSchemasOptions) {
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

  const fetchSchemas = useCallback(async () => {
    if (!enabled || !isFeatureEnabled) {
      return;
    }

    const currentQueries = queriesRef.current;
    if (!currentQueries) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const nonDashboardQueries = currentQueries.filter((q) => !isDashboardDatasource(q));

      if (nonDashboardQueries.length === 0) {
        setSchemas({ kind: 'SQLSchemaResponse', apiVersion: 'query.grafana.app/v0alpha1', sqlSchemas: {} });
        setLoading(false);
        return;
      }

      const defaultDs = getDataSourceSrv().getInstanceSettings(null);
      const resolvedQueries = nonDashboardQueries.map((query) => {
        if (!query.datasource && defaultDs) {
          return { ...query, datasource: { uid: defaultDs.uid, type: defaultDs.type } };
        }
        return query;
      });

      // Interpolate dashboard variables in source queries so the schema
      // request mirrors what the panel execution path actually sends. Without
      // this, datasources like Prometheus can reject raw `$var` / `$__macro`
      // syntax and datasources like Loki silently return empty data.
      const interpolatedQueries = await interpolateSourceQueries(
        resolvedQueries,
        scopedVarsRef.current ?? {},
        filtersRef.current
      );

      const namespace = getAPINamespace();
      const currentTimeRange = timeRange || getDefaultTimeRange();

      const response = await getBackendSrv().post<SQLSchemasResponse>(
        `/apis/query.grafana.app/v0alpha1/namespaces/${namespace}/sqlschemas`,
        {
          queries: interpolatedQueries,
          from: currentTimeRange.from.toISOString(),
          to: currentTimeRange.to.toISOString(),
        }
      );

      setSchemas(response);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch SQL schemas'));
    } finally {
      setLoading(false);
    }
  }, [enabled, isFeatureEnabled, timeRange]);

  // Refetch on mount, when fetchSchemas identity changes (enabled/feature/timeRange),
  // and when scopedVars/filters change by value. Identity-based comparison would
  // refetch on every parent render that creates new context objects with the same
  // contents; deep comparison avoids that.
  useDeepCompareEffect(() => {
    fetchSchemas();
  }, [fetchSchemas, scopedVars ?? {}, filters ?? []]);

  return { schemas, loading, error, isFeatureEnabled, refetch: fetchSchemas };
}

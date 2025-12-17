import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

import { getAPINamespace } from '@grafana/api-clients';
import { getDefaultTimeRange, TimeRange } from '@grafana/data';
import { config, getBackendSrv } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';

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
}

export function useSQLSchemas({ queries, enabled, timeRange }: UseSQLSchemasOptions) {
  const isFeatureEnabled = useMemo(
    () => config.featureToggles.queryService || config.featureToggles.grafanaAPIServerWithExperimentalAPIs || false,
    []
  );

  // Start with loading=true if we're going to fetch on mount
  const [schemas, setSchemas] = useState<SQLSchemasResponse | null>(null);
  const [loading, setLoading] = useState(enabled && isFeatureEnabled && Boolean(queries));
  const [error, setError] = useState<Error | null>(null);

  // Store queries in ref so we can access current value without triggering effect
  const queriesRef = useRef(queries);
  queriesRef.current = queries;

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
      if (currentQueries.length === 0) {
        setSchemas({ kind: 'SQLSchemaResponse', apiVersion: 'query.grafana.app/v0alpha1', sqlSchemas: {} });
        setLoading(false);
        return;
      }

      const namespace = getAPINamespace();
      const currentTimeRange = timeRange || getDefaultTimeRange();

      const response = await getBackendSrv().post<SQLSchemasResponse>(
        `/apis/query.grafana.app/v0alpha1/namespaces/${namespace}/sqlschemas/name`,
        {
          queries: currentQueries,
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

  useEffect(() => {
    fetchSchemas();
  }, [fetchSchemas]);

  return { schemas, loading, error, isFeatureEnabled, refetch: fetchSchemas };
}

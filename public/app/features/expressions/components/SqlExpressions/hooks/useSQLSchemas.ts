import { useState, useEffect, useRef } from 'react';

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
}

const ONE_HOUR_MS = 60 * 60 * 1000;

export function useSQLSchemas({ queries, enabled }: UseSQLSchemasOptions) {
  const [schemas, setSchemas] = useState<SQLSchemasResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Store queries in ref so we can access current value without triggering effect
  const queriesRef = useRef(queries);
  queriesRef.current = queries;

  const isFeatureEnabled =
    config.featureToggles.queryService || config.featureToggles.grafanaAPIServerWithExperimentalAPIs || false;

  useEffect(() => {
    if (!enabled || !isFeatureEnabled) {
      return;
    }

    const currentQueries = queriesRef.current;
    if (!currentQueries) {
      return;
    }

    const fetchSchemas = async () => {
      setLoading(true);
      setError(null);

      try {
        // Filter to only datasource queries (not expression queries)
        const datasourceQueries = currentQueries.filter(({ datasource }: DataQuery) => {
          return datasource && datasource.type !== '__expr__' && datasource.uid !== '__expr__';
        });

        if (datasourceQueries.length === 0) {
          setSchemas({ kind: 'SQLSchemaResponse', apiVersion: 'query.grafana.app/v0alpha1', sqlSchemas: {} });
          setLoading(false);
          return;
        }

        const namespace = 'default';

        const response = await getBackendSrv().post<SQLSchemasResponse>(
          `/apis/query.grafana.app/v0alpha1/namespaces/${namespace}/sqlschemas/name`,
          {
            queries: datasourceQueries,
            from: new Date(Date.now() - ONE_HOUR_MS).toISOString(),
            to: new Date().toISOString(),
          }
        );

        setSchemas(response);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch SQL schemas'));
      } finally {
        setLoading(false);
      }
    };

    fetchSchemas();
  }, [enabled, isFeatureEnabled]);

  return { schemas, loading, error, isFeatureEnabled };
}

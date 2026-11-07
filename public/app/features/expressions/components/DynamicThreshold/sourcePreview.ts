import { useEffect, useMemo, useRef, useState } from 'react';
import { useDeepCompareEffect } from 'react-use';

import { FieldType, generateUUID, type SelectableValue } from '@grafana/data';
import { quoteIdentifierIfNecessary } from '@grafana/sql';
import { type AlertQuery } from 'app/types/unified-alerting-dto';

import { dataSource } from '../../ExpressionDatasource';
import { isExpressionQuery } from '../../guards';
import { interpolateSourceQueries } from '../../utils/interpolateSourceQueries';
import { fetchSQLFields } from '../../utils/metaSqlExpr';
import { SQL_EXPRESSIONS_DIALECT } from '../../utils/sqlIdentifier';
import { type SQLSchemaField, useSQLSchemas } from '../SqlExpressions/hooks/useSQLSchemas';

import { getSourceQueryKey, useSourceQueryTimeRange } from './utils';

export interface DynamicThresholdSourceSchema {
  numericFields: string[];
  stringFields: string[];
  labelValues: string[];
}

export function getDynamicThresholdSourceOptions(
  queries: AlertQuery[],
  selfRefId: string
): Array<SelectableValue<string>> {
  return queries
    .filter((query) => query.refId !== selfRefId && !isExpressionQuery(query.model))
    .map((query) => ({ value: query.refId, label: query.refId }));
}

export function classifySchemaFields(columns: SQLSchemaField[]): Omit<DynamicThresholdSourceSchema, 'labelValues'> {
  const numericFields: string[] = [];
  const stringFields: string[] = [];

  for (const column of columns) {
    const type = column.dataFrameFieldType.toLowerCase().replace(/^\*+/, '');
    if (type === FieldType.number || type === 'number' || /^(?:u?int|float)/.test(type)) {
      numericFields.push(column.name);
    } else if (type === FieldType.string || type === 'string') {
      stringFields.push(column.name);
    }
  }

  return { numericFields, stringFields };
}

export function useDynamicThresholdSourcePreview(queries: AlertQuery[], inputRefId: string, matchLabel: string) {
  const sourceQuery = queries.find((query) => query.refId === inputRefId && !isExpressionQuery(query.model));
  const timeRange = useSourceQueryTimeRange(sourceQuery);
  const sourceQueries = useMemo(() => (sourceQuery ? [sourceQuery.model] : []), [sourceQuery]);
  const { schemas, loading, error, isFeatureEnabled, refetch } = useSQLSchemas({
    queries: sourceQueries,
    enabled: Boolean(sourceQuery),
    timeRange,
  });
  const sourceKey = getSourceQueryKey(inputRefId, sourceQuery);
  const previousSourceKey = useRef(sourceKey);
  const hasProcessedSource = useRef(false);
  const [schemaSourceKey, setSchemaSourceKey] = useState(sourceKey);
  useDeepCompareEffect(() => {
    const previousKey = previousSourceKey.current;
    previousSourceKey.current = sourceKey;
    setSchemaSourceKey(sourceKey);

    if (!hasProcessedSource.current) {
      hasProcessedSource.current = true;
      return;
    }
    if (!sourceKey || !previousKey) {
      return;
    }

    let cancelled = false;
    setSchemaSourceKey('');
    void refetch().then(() => {
      if (!cancelled) {
        setSchemaSourceKey(sourceKey);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [sourceQuery?.model, inputRefId, refetch]);

  const schema =
    sourceQuery && sourceKey && schemaSourceKey === sourceKey ? schemas?.sqlSchemas[inputRefId] : undefined;
  const endpointError =
    isFeatureEnabled && sourceKey && schemaSourceKey === sourceKey
      ? (error ?? (schema?.error ? new Error(schema.error) : null))
      : null;
  const shouldUseFallback = Boolean(sourceQuery) && (!isFeatureEnabled || Boolean(endpointError));
  const [fallbackResult, setFallbackResult] = useState<{
    key: string;
    fields: SQLSchemaField[] | null;
    error: Error | null;
  }>({ key: '', fields: null, error: null });
  const [labelValueResult, setLabelValueResult] = useState<{ key: string; values: string[] }>({
    key: '',
    values: [],
  });

  useEffect(() => {
    if (!sourceQuery || !sourceKey || !shouldUseFallback) {
      return;
    }

    let cancelled = false;
    fetchSQLFields({ table: inputRefId }, [sourceQuery.model], { range: timeRange, isCancelled: () => cancelled })
      .then((fields) => {
        if (!cancelled) {
          setFallbackResult({
            key: sourceKey,
            fields: fields.map((field) => ({
              name: field.name,
              mysqlType: field.type ?? '',
              dataFrameFieldType: field.type ?? '',
              nullable: true,
            })),
            error: null,
          });
        }
      })
      .catch(
        (reason) =>
          !cancelled &&
          setFallbackResult({
            key: sourceKey,
            fields: null,
            error: reason instanceof Error ? reason : new Error(String(reason)),
          })
      );
    return () => {
      cancelled = true;
    };
  }, [inputRefId, shouldUseFallback, sourceKey, sourceQuery, timeRange]);

  useEffect(() => {
    if (!sourceQuery || !sourceKey || !matchLabel) {
      return;
    }

    let cancelled = false;
    const table = quoteIdentifierIfNecessary(inputRefId, SQL_EXPRESSIONS_DIALECT);
    const label = quoteIdentifierIfNecessary(matchLabel, SQL_EXPRESSIONS_DIALECT);
    const refId = `dynamic-threshold-label-values-${generateUUID()}`;
    interpolateSourceQueries([sourceQuery.model], {})
      .then((interpolatedQueries) =>
        cancelled
          ? undefined
          : dataSource.runMetaSQLExprQuery(
              {
                rawSql: `SELECT DISTINCT ${label} FROM ${table} WHERE ${label} IS NOT NULL ORDER BY ${label} LIMIT 100`,
                refId,
              },
              timeRange,
              interpolatedQueries
            )
      )
      .then((frame) => {
        if (!cancelled && frame) {
          const field = frame.fields.find((field) => field.name === matchLabel) ?? frame.fields[0];
          setLabelValueResult({
            key: `${sourceKey}\0${matchLabel}`,
            values: field
              ? Array.from(new Set(field.values.filter((value): value is string => typeof value === 'string')))
              : [],
          });
        }
      })
      .catch(() => (!cancelled ? setLabelValueResult({ key: `${sourceKey}\0${matchLabel}`, values: [] }) : undefined));
    return () => {
      cancelled = true;
    };
  }, [inputRefId, matchLabel, sourceKey, sourceQuery, timeRange]);

  const fallback = fallbackResult.key === sourceKey ? fallbackResult : null;
  const fields = shouldUseFallback ? fallback?.fields : schema?.columns;
  const classified = classifySchemaFields(fields ?? []);
  const labelValues = labelValueResult.key === `${sourceKey}\0${matchLabel}` ? labelValueResult.values : [];
  const fallbackFailed = Boolean(fallback?.error);

  return {
    ...classified,
    labelValues,
    loading: isFeatureEnabled && !endpointError ? loading : Boolean(sourceQuery) && !fallback,
    error: shouldUseFallback ? (fallbackFailed ? (endpointError ?? fallback?.error ?? null) : null) : endpointError,
    hasSchema: Boolean(sourceQuery && sourceKey && fields !== null && fields !== undefined),
  };
}

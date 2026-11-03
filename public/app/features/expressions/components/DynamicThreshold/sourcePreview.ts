import { useEffect, useMemo, useRef, useState } from 'react';
import { useDeepCompareEffect } from 'react-use';

import { FieldType, generateUUID, getDefaultTimeRange, type SelectableValue } from '@grafana/data';
import { quoteIdentifierIfNecessary } from '@grafana/sql';
import { type AlertQuery } from 'app/types/unified-alerting-dto';

import { dataSource } from '../../ExpressionDatasource';
import { isExpressionQuery } from '../../guards';
import { interpolateSourceQueries } from '../../utils/interpolateSourceQueries';
import { fetchSQLFields } from '../../utils/metaSqlExpr';
import { SQL_EXPRESSIONS_DIALECT } from '../../utils/sqlIdentifier';
import { type SQLSchemaField, useSQLSchemas } from '../SqlExpressions/hooks/useSQLSchemas';

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
  const sourceQueries = useMemo(() => (sourceQuery ? [sourceQuery.model] : []), [sourceQuery]);
  const { schemas, loading, error, isFeatureEnabled, refetch } = useSQLSchemas({
    queries: sourceQueries,
    enabled: Boolean(sourceQuery),
  });
  const sourceKey = sourceQuery ? `${inputRefId}\0${JSON.stringify(sourceQuery.model)}` : '';
  const initialSchemaFetch = useRef(true);
  const [schemaSourceKey, setSchemaSourceKey] = useState(sourceKey);
  useDeepCompareEffect(() => {
    if (initialSchemaFetch.current) {
      initialSchemaFetch.current = false;
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
    if (!sourceQuery || isFeatureEnabled) {
      return;
    }

    let cancelled = false;
    fetchSQLFields({ table: inputRefId }, [sourceQuery.model])
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
  }, [inputRefId, isFeatureEnabled, sourceKey, sourceQuery]);

  useEffect(() => {
    if (!sourceQuery || !matchLabel) {
      return;
    }

    let cancelled = false;
    const table = quoteIdentifierIfNecessary(inputRefId, SQL_EXPRESSIONS_DIALECT);
    const label = quoteIdentifierIfNecessary(matchLabel, SQL_EXPRESSIONS_DIALECT);
    const refId = `dynamic-threshold-label-values-${generateUUID()}`;
    interpolateSourceQueries([sourceQuery.model], {})
      .then((interpolatedQueries) =>
        dataSource.runMetaSQLExprQuery(
          {
            rawSql: `SELECT DISTINCT ${label} FROM ${table} WHERE ${label} IS NOT NULL ORDER BY ${label} LIMIT 100`,
            refId,
          },
          getDefaultTimeRange(),
          interpolatedQueries
        )
      )
      .then((frame) => {
        if (!cancelled) {
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
  }, [inputRefId, matchLabel, sourceKey, sourceQuery]);

  const schema = schemaSourceKey === sourceKey ? schemas?.sqlSchemas[inputRefId] : undefined;
  const fields = isFeatureEnabled ? schema?.columns : fallbackResult.key === sourceKey ? fallbackResult.fields : null;
  const classified = classifySchemaFields(fields ?? []);
  const labelValues = labelValueResult.key === `${sourceKey}\0${matchLabel}` ? labelValueResult.values : [];

  return {
    ...classified,
    labelValues,
    loading: isFeatureEnabled ? loading : Boolean(sourceQuery) && fallbackResult.key !== sourceKey,
    error: isFeatureEnabled
      ? (error ?? (schema?.error ? new Error(schema.error) : null))
      : fallbackResult.key === sourceKey
        ? fallbackResult.error
        : null,
    hasSchema: fields !== null && fields !== undefined,
  };
}

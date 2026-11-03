import { useEffect, useMemo, useState } from 'react';

import { FieldType, getDefaultTimeRange, type SelectableValue } from '@grafana/data';
import { quoteIdentifierIfNecessary } from '@grafana/sql';
import { type AlertQuery } from 'app/types/unified-alerting-dto';

import { dataSource } from '../../ExpressionDatasource';
import { isExpressionQuery } from '../../guards';
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
    const type = column.dataFrameFieldType.toLowerCase();
    if (type === FieldType.number || type === 'number') {
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
  const { schemas, loading, error, isFeatureEnabled } = useSQLSchemas({
    queries: sourceQueries,
    enabled: Boolean(sourceQuery),
  });
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
    dataSource
      .runMetaSQLExprQuery(
        { rawSql: `SELECT * FROM ${quoteIdentifierIfNecessary(inputRefId, SQL_EXPRESSIONS_DIALECT)} LIMIT 1` },
        getDefaultTimeRange(),
        [sourceQuery.model]
      )
      .then((frame) => {
        if (!cancelled) {
          setFallbackResult({
            key: inputRefId,
            fields: frame.fields.map((field) => ({
              name: field.name,
              mysqlType: field.type,
              dataFrameFieldType: field.type,
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
            key: inputRefId,
            fields: null,
            error: reason instanceof Error ? reason : new Error(String(reason)),
          })
      );
    return () => {
      cancelled = true;
    };
  }, [inputRefId, isFeatureEnabled, sourceQuery]);

  useEffect(() => {
    if (!sourceQuery || !matchLabel) {
      return;
    }

    let cancelled = false;
    const table = quoteIdentifierIfNecessary(inputRefId, SQL_EXPRESSIONS_DIALECT);
    const label = quoteIdentifierIfNecessary(matchLabel, SQL_EXPRESSIONS_DIALECT);
    dataSource
      .runMetaSQLExprQuery(
        { rawSql: `SELECT DISTINCT ${label} FROM ${table} WHERE ${label} IS NOT NULL ORDER BY ${label} LIMIT 100` },
        getDefaultTimeRange(),
        [sourceQuery.model]
      )
      .then((frame) => {
        if (!cancelled) {
          const field = frame.fields.find((field) => field.name === matchLabel) ?? frame.fields[0];
          setLabelValueResult({
            key: `${inputRefId}\0${matchLabel}`,
            values: field
              ? Array.from(new Set(field.values.filter((value): value is string => typeof value === 'string')))
              : [],
          });
        }
      })
      .catch(() => (!cancelled ? setLabelValueResult({ key: `${inputRefId}\0${matchLabel}`, values: [] }) : undefined));
    return () => {
      cancelled = true;
    };
  }, [inputRefId, matchLabel, sourceQuery]);

  const schema = schemas?.sqlSchemas[inputRefId];
  const fields = isFeatureEnabled ? schema?.columns : fallbackResult.key === inputRefId ? fallbackResult.fields : null;
  const classified = classifySchemaFields(fields ?? []);
  const labelValues = labelValueResult.key === `${inputRefId}\0${matchLabel}` ? labelValueResult.values : [];

  return {
    ...classified,
    labelValues,
    loading: isFeatureEnabled ? loading : Boolean(sourceQuery) && fallbackResult.key !== inputRefId,
    error: isFeatureEnabled
      ? (error ?? (schema?.error ? new Error(schema.error) : null))
      : fallbackResult.key === inputRefId
        ? fallbackResult.error
        : null,
    hasSchema: fields !== null && fields !== undefined,
  };
}

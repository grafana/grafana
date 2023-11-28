import { css } from '@emotion/css';
import { uniqueId } from 'lodash';
import React, { useCallback } from 'react';

import { SelectableValue, toOption } from '@grafana/data';
import { EditorField, Stack } from '@grafana/experimental';
import { Button, Select, useStyles2 } from '@grafana/ui';

import { QueryEditorExpressionType, QueryEditorFunctionExpression } from '../../expressions';
import { SQLExpression, QueryFormat } from '../../types';
import { createFunctionField } from '../../utils/sql.utils';

interface SelectRowProps {
  sql: SQLExpression;
  format: QueryFormat | undefined;
  onSqlChange: (sql: SQLExpression) => void;
  columns?: Array<SelectableValue<string>>;
  functions?: Array<SelectableValue<string>>;
}

const asteriskValue = { label: '*', value: '*' };

export function SelectRow({ sql, format, columns, onSqlChange, functions }: SelectRowProps) {
  const styles = useStyles2(getStyles);
  const columnsWithAsterisk = [asteriskValue, ...(columns || [])];
  const timeSeriesAliasOpts: Array<SelectableValue<string>> = [];

  // Add necessary alias options for time series format
  // when that format has been selected
  if (format === QueryFormat.Timeseries) {
    timeSeriesAliasOpts.push({ label: 'time', value: 'time' });
    timeSeriesAliasOpts.push({ label: 'value', value: 'value' });
  }

  const onColumnChange = useCallback(
    (item: QueryEditorFunctionExpression, index: number) => (column: SelectableValue<string>) => {
      let modifiedItem = { ...item };
      if (!item.parameters?.length) {
        modifiedItem.parameters = [{ type: QueryEditorExpressionType.FunctionParameter, name: column.value } as const];
      } else {
        modifiedItem.parameters = item.parameters.map((p) =>
          p.type === QueryEditorExpressionType.FunctionParameter ? { ...p, name: column.value } : p
        );
      }

      const newSql: SQLExpression = {
        ...sql,
        columns: sql.columns?.map((c, i) => (i === index ? modifiedItem : c)),
      };

      onSqlChange(newSql);
    },
    [onSqlChange, sql]
  );

  const onAggregationChange = useCallback(
    (item: QueryEditorFunctionExpression, index: number) => (aggregation: SelectableValue<string>) => {
      const newItem = {
        ...item,
        name: aggregation?.value,
      };
      const newSql: SQLExpression = {
        ...sql,
        columns: sql.columns?.map((c, i) => (i === index ? newItem : c)),
      };

      onSqlChange(newSql);
    },
    [onSqlChange, sql]
  );

  const onAliasChange = useCallback(
    (item: QueryEditorFunctionExpression, index: number) => (alias: SelectableValue<string>) => {
      let newItem = { ...item };

      if (alias !== null) {
        newItem = { ...item, alias: `"${alias?.value?.trim()}"` };
      } else {
        delete newItem.alias;
      }

      const newSql: SQLExpression = {
        ...sql,
        columns: sql.columns?.map((c, i) => (i === index ? newItem : c)),
      };

      onSqlChange(newSql);
    },
    [onSqlChange, sql]
  );

  const removeColumn = useCallback(
    (index: number) => () => {
      const clone = [...sql.columns!];
      clone.splice(index, 1);
      const newSql: SQLExpression = {
        ...sql,
        columns: clone,
      };
      onSqlChange(newSql);
    },
    [onSqlChange, sql]
  );

  const addColumn = useCallback(() => {
    const newSql: SQLExpression = { ...sql, columns: [...sql.columns!, createFunctionField()] };
    onSqlChange(newSql);
  }, [onSqlChange, sql]);

  return (
    <Stack gap={2} wrap direction="column">
      {sql.columns?.map((item, index) => (
        <div key={index}>
          <Stack gap={2} alignItems="end">
            <EditorField label="Column" width={25}>
              <Select
                value={getColumnValue(item)}
                options={columnsWithAsterisk}
                inputId={`select-column-${index}-${uniqueId()}`}
                menuShouldPortal
                allowCustomValue
                onChange={onColumnChange(item, index)}
              />
            </EditorField>

            <EditorField label="Aggregation" optional width={25}>
              <Select
                value={item.name ? toOption(item.name) : null}
                inputId={`select-aggregation-${index}-${uniqueId()}`}
                isClearable
                menuShouldPortal
                allowCustomValue
                options={functions}
                onChange={onAggregationChange(item, index)}
              />
            </EditorField>
            <EditorField label="Alias" optional width={15}>
              <Select
                value={item.alias ? toOption(item.alias) : null}
                inputId={`select-alias-${index}-${uniqueId()}`}
                options={timeSeriesAliasOpts}
                onChange={onAliasChange(item, index)}
                isClearable
                menuShouldPortal
                allowCustomValue
              />
            </EditorField>
            <Button
              aria-label="Remove"
              type="button"
              icon="trash-alt"
              variant="secondary"
              size="md"
              onClick={removeColumn(index)}
            />
          </Stack>
        </div>
      ))}
      <Button
        type="button"
        onClick={addColumn}
        variant="secondary"
        size="md"
        icon="plus"
        aria-label="Add"
        className={styles.addButton}
      />
    </Stack>
  );
}

const getStyles = () => {
  return { addButton: css({ alignSelf: 'flex-start' }) };
};

function getColumnValue({ parameters }: QueryEditorFunctionExpression): SelectableValue<string> | null {
  const column = parameters?.find((p) => p.type === QueryEditorExpressionType.FunctionParameter);
  if (column?.name) {
    return toOption(column.name);
  }
  return null;
}

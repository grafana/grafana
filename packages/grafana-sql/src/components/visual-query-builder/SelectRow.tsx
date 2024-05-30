import { css } from '@emotion/css';
import { uniqueId } from 'lodash';
import React, { useCallback } from 'react';

import { SelectableValue, toOption } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { EditorField } from '@grafana/experimental';
import { Button, Select, useStyles2, Stack, InlineLabel, Input } from '@grafana/ui';

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

  const onAggregationChange = useCallback(
    (item: QueryEditorFunctionExpression, index: number) => (aggregation: SelectableValue<string>) => {
      const newItem = {
        ...item,
        name: aggregation?.value,
        parameters: [
          { type: QueryEditorExpressionType.FunctionParameter as const, name: item.parameters?.[0]?.name || '' },
        ],
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

  const addParameter = useCallback(
    (index: number) => () => {
      const item = sql.columns![index];

      item.parameters = item.parameters
        ? [...item.parameters, { type: QueryEditorExpressionType.FunctionParameter, name: '' }]
        : [];

      const newSql: SQLExpression = {
        ...sql,
        columns: sql.columns?.map((c, i) => (i === index ? item : c)),
      };

      onSqlChange(newSql);
    },
    [onSqlChange, sql]
  );

  const removeParameter = useCallback(
    (columnIndex: number, index: number) => () => {
      const item = sql.columns![columnIndex];
      item.parameters = item.parameters?.filter((_, i) => i !== index);

      const newSql: SQLExpression = {
        ...sql,
        columns: sql.columns?.map((c, i) => (i === columnIndex ? item : c)),
      };

      onSqlChange(newSql);
    },
    [onSqlChange, sql]
  );

  const onParameterChange = useCallback(
    (columnIndex: number, index: number) => (s: string) => {
      const item = sql.columns![columnIndex];
      if (!item.parameters) {
        item.parameters = [];
      }
      if (item.parameters[index] === undefined) {
        item.parameters[index] = { type: QueryEditorExpressionType.FunctionParameter, name: s };
      } else {
        item.parameters = item.parameters.map((p, i) => (i === index ? { ...p, name: s } : p));
      }

      const newSql: SQLExpression = {
        ...sql,
        columns: sql.columns?.map((c, i) => (i === columnIndex ? item : c)),
      };

      onSqlChange(newSql);
    },
    [onSqlChange, sql]
  );

  function renderParameters(item: QueryEditorFunctionExpression, columnIndex: number) {
    if (!item.parameters || item.parameters.length <= 1) {
      return null;
    }

    const paramComponents = item.parameters.map((param, index) => {
      // Skip the first parameter as it is the column name
      if (index === 0) {
        return null;
      }

      return (
        <Stack key={index} gap={2}>
          <InlineLabel className={styles.label}>,</InlineLabel>
          <Input
            onChange={(e) => onParameterChange(columnIndex, index)(e.currentTarget.value)}
            value={param.name}
            data-testid={selectors.components.SQLQueryEditor.selectInputParameter}
            addonAfter={
              <Button
                aria-label="Remove parameter"
                tooltip="Remove parameter"
                type="button"
                icon="times"
                variant="secondary"
                size="md"
                onClick={removeParameter(columnIndex, index)}
              />
            }
          />
        </Stack>
      );
    });
    return paramComponents;
  }

  return (
    <Stack gap={2} wrap="wrap" direction="column">
      {sql.columns?.map((item, index) => (
        <div key={index}>
          <Stack gap={2} alignItems="end">
            <EditorField label="Aggregation / Macros" optional width={25}>
              <Select
                value={item.name ? toOption(item.name) : null}
                inputId={`select-aggregation-${index}-${uniqueId()}`}
                data-testid={selectors.components.SQLQueryEditor.selectAggregation}
                isClearable
                menuShouldPortal
                allowCustomValue
                options={functions}
                onChange={onAggregationChange(item, index)}
              />
            </EditorField>
            {item.name !== undefined && <InlineLabel className={styles.label}>(</InlineLabel>}
            <EditorField label="Column" width={25}>
              <Select
                value={getColumnValue(item)}
                data-testid={selectors.components.SQLQueryEditor.selectColumn}
                options={columnsWithAsterisk}
                inputId={`select-column-${index}-${uniqueId()}`}
                menuShouldPortal
                allowCustomValue
                onChange={(s) => onParameterChange(index, 0)(s.value!)}
              />
            </EditorField>
            {item.name !== undefined && (
              <>
                {renderParameters(item, index)}
                <Button
                  type="button"
                  onClick={addParameter(index)}
                  variant="secondary"
                  size="md"
                  icon="plus"
                  tooltip="Add parameter"
                  aria-label="Add parameter"
                />
                <InlineLabel className={styles.label}>)</InlineLabel>
              </>
            )}
            <EditorField label="Alias" optional width={15}>
              <Select
                value={item.alias ? toOption(item.alias) : null}
                inputId={`select-alias-${index}-${uniqueId()}`}
                data-testid={selectors.components.SQLQueryEditor.selectAlias}
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
  return {
    addButton: css({ alignSelf: 'flex-start' }),
    label: css({
      padding: 0,
      margin: 0,
      width: 'unset',
    }),
  };
};

function getColumnValue({ parameters }: QueryEditorFunctionExpression): SelectableValue<string> | null {
  const column = parameters?.find((p) => p.type === QueryEditorExpressionType.FunctionParameter);
  if (column?.name) {
    return toOption(column.name);
  }
  return null;
}

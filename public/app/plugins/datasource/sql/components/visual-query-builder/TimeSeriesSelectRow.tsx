import { css } from '@emotion/css';
import { uniqueId } from 'lodash';
import React, { useCallback } from 'react';

import { SelectableValue, toOption } from '@grafana/data';
import { EditorField, Stack } from '@grafana/experimental';
import { Button, Select, useStyles2 } from '@grafana/ui';

import { AGGREGATE_FNS } from '../../constants';
import { QueryEditorExpressionType, QueryEditorFunctionExpression } from '../../expressions';
import { SQLExpression } from '../../types';
import { createFunctionField } from '../../utils/sql.utils';

interface SelectRowProps {
  sql: SQLExpression;
  onSqlChange: (sql: SQLExpression) => void;
  columns?: Array<SelectableValue<string>>;
}

const dropdownLabels = ['Time', 'Value', 'Metric'];

export function TimeSeriesSelectRow({ sql, columns, onSqlChange }: SelectRowProps) {
  const styles = useStyles2(getStyles);

  const onColumnChange = useCallback(
    (item: QueryEditorFunctionExpression, index: number) => (column: SelectableValue<string>) => {
      let modifiedItem = { ...item };
      console.log('modifiedItem', modifiedItem);
      console.log('index', index);
      if (!item.parameters?.length) {
        modifiedItem.parameters = [{ type: QueryEditorExpressionType.FunctionParameter, name: column.value } as const];
      } else {
        modifiedItem.parameters = item.parameters.map((p) =>
          p.type === QueryEditorExpressionType.FunctionParameter ? { ...p, name: column.value } : p
        );
      }

      console.log('sql.columns', sql.columns);

      const newSql: SQLExpression = {
        ...sql,
        columns: sql.columns?.map((c, i) => (i === index ? modifiedItem : c)),
      };

      console.log('newSql', newSql);

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

  const getDropdownValues = (index: number) => {
    const timeValues = ['date', 'datetime', 'time'];
    const values = ['time', 'number', 'text'];
    return index === 0
      ? columns?.filter((c) => timeValues.includes(c.type))
      : columns?.filter((c) => c.type === values[index]);
  };

  return (
    <Stack gap={2} alignItems="end" wrap direction="column">
      {sql.columns?.map((item, index) => (
        <div key={index}>
          <Stack gap={2} alignItems="end">
            <EditorField label={dropdownLabels[index]} width={25}>
              <Select
                value={getColumnValue(item)}
                options={getDropdownValues(index)}
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
                options={aggregateFnOptions}
                onChange={onAggregationChange(item, index)}
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

const aggregateFnOptions = AGGREGATE_FNS.map((v: { id: string; name: string; description: string }) =>
  toOption(v.name)
);

function getColumnValue({ parameters }: QueryEditorFunctionExpression): SelectableValue<string> | null {
  const column = parameters?.find((p) => p.type === QueryEditorExpressionType.FunctionParameter);
  if (column?.name) {
    return toOption(column.name);
  }
  return null;
}

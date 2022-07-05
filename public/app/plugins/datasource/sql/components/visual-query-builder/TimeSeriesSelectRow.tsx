import { uniqueId } from 'lodash';
import React, { useCallback } from 'react';

import { SelectableValue, toOption } from '@grafana/data';
import { EditorField, Stack } from '@grafana/experimental';
import { Select } from '@grafana/ui';

// import { AGGREGATE_FNS } from '../../constants';
import { QueryEditorExpressionType, QueryEditorFunctionExpression } from '../../expressions';
import { SQLExpression } from '../../types';
import { setPropertyField } from '../../utils/sql.utils';

interface SelectRowProps {
  sql: SQLExpression;
  onSqlChange: (sql: SQLExpression) => void;
  columns?: Array<SelectableValue<string>>;
}

const dropdownLabels = ['Time', 'Value', 'Metric'];

export function TimeSeriesSelectRow({ sql, columns, onSqlChange }: SelectRowProps) {
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

      console.log('modifiedItem', modifiedItem);
      const timeValues = ['date', 'datetime', 'time'];
      let newSql: SQLExpression;

      if (timeValues.includes(modifiedItem.parameters[0].name!)) {
        newSql = {
          ...sql,
          orderBy: setPropertyField(modifiedItem?.parameters[0].name),
          columns: sql.columns?.map((c, i) => (i === index ? modifiedItem : c)),
        };
        console.log('newSql', newSql);
      } else {
        newSql = {
          ...sql,
          columns: sql.columns?.map((c, i) => (i === index ? modifiedItem : c)),
        };
      }

      onSqlChange(newSql);
    },
    [onSqlChange, sql]
  );

  // const onAggregationChange = useCallback(
  //   (item: QueryEditorFunctionExpression, index: number) => (aggregation: SelectableValue<string>) => {
  //     const newItem = {
  //       ...item,
  //       name: aggregation?.value,
  //     };
  //     const newSql: SQLExpression = {
  //       ...sql,
  //       columns: sql.columns?.map((c, i) => (i === index ? newItem : c)),
  //     };

  //     onSqlChange(newSql);
  //   },
  //   [onSqlChange, sql]
  // );

  const getDropdownValues = (index: number) => {
    const timeValues = ['date', 'datetime', 'time'];
    const values = ['time', 'number', 'text'];
    return index === 0
      ? columns?.filter((c) => timeValues.includes(c.type))
      : columns?.filter((c) => c.raqbFieldType === values[index]);
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

            {/* {index === 1 && 
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
            } */}
          </Stack>
        </div>
      ))}
    </Stack>
  );
}

// const aggregateFnOptions = AGGREGATE_FNS.map((v: { id: string; name: string; description: string }) =>
//   toOption(v.name)
// );

function getColumnValue({ parameters }: QueryEditorFunctionExpression): SelectableValue<string> | null {
  const column = parameters?.find((p) => p.type === QueryEditorExpressionType.FunctionParameter);
  if (column?.name) {
    return toOption(column.name);
  }
  return null;
}

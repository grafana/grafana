import { range } from 'lodash';
import React from 'react';

import { SelectableValue } from '@grafana/data';
import { AccessoryButton, InputGroup } from '@grafana/plugin-ui';
import { Select, Label } from '@grafana/ui';

import { AggregateFunctions, QueryEditorProperty, QueryEditorPropertyType } from '../../types';

import { QueryEditorExpressionType, QueryEditorReduceExpression } from './expressions';
import { valueToDefinition } from './utils';

interface AggregateItemProps {
  aggregate: Partial<QueryEditorReduceExpression>;
  columns: SelectableValue<string> | undefined;
  templateVariableOptions?: SelectableValue<string>;
  onChange: (item: QueryEditorReduceExpression) => void;
  onDelete: () => void;
}

export const AggregateItem: React.FC<AggregateItemProps> = (props) => {
  const { aggregate, onChange, onDelete, columns, templateVariableOptions } = props;

  let columnOptions: Array<SelectableValue<string>> = Array.isArray(columns)
    ? columns.map((c) => ({ label: c.label, value: c.value }))
    : [];

  if (templateVariableOptions) {
    columnOptions = columnOptions.concat(templateVariableOptions);
  }

  const getDefaultProperty = (): QueryEditorProperty => ({
    name: aggregate.property?.name || '',
    type: aggregate.property?.type || QueryEditorPropertyType.String,
  });

  return (
    <InputGroup>
      <Select
        data-testid="aggregate-item-function"
        aria-label="function"
        width="auto"
        value={aggregate.reduce?.name ? valueToDefinition(aggregate.reduce?.name) : null}
        options={Object.values(AggregateFunctions).map((f) => ({ label: f, value: f }))}
        allowCustomValue
        onChange={(e) =>
          e.value &&
          onChange({
            ...aggregate,
            type: QueryEditorExpressionType.Reduce,
            property: getDefaultProperty(),
            reduce: { name: e.value, type: QueryEditorPropertyType.Function },
          })
        }
      />
      {aggregate.reduce?.name === AggregateFunctions.Percentile ? (
        <Select
          aria-label="percentile"
          options={range(0, 100, 5).map((n) => ({ label: n.toString(), value: n.toString() }))}
          value={aggregate.parameters?.length ? aggregate.parameters[0].value : undefined}
          width="auto"
          allowCustomValue
          onChange={(e) => {
            e.value &&
              onChange({
                ...aggregate,
                type: QueryEditorExpressionType.Reduce,
                property: getDefaultProperty(),
                reduce: aggregate.reduce ?? { name: '', type: QueryEditorPropertyType.Function },
                parameters: [
                  {
                    type: QueryEditorExpressionType.FunctionParameter,
                    fieldType: QueryEditorPropertyType.Number,
                    value: e.value,
                    name: 'percentileParam',
                  },
                ],
              });
          }}
        />
      ) : (
        <></>
      )}
      {aggregate.reduce?.name !== AggregateFunctions.Count && aggregate.reduce?.name !== AggregateFunctions.Dcount ? (
        <>
          <Label style={{ margin: '9px 9px 0 9px' }}>of</Label>
          <Select
            aria-label="column"
            width={'auto'}
            value={aggregate.property?.name ? valueToDefinition(aggregate.property?.name) : null}
            options={Array.isArray(columnOptions) ? columnOptions : [columnOptions]}
            allowCustomValue
            onChange={(e) =>
              e.value &&
              onChange({
                ...aggregate,
                type: QueryEditorExpressionType.Reduce,
                reduce: aggregate.reduce ?? { name: '', type: QueryEditorPropertyType.Function },
                property: {
                  name: e.value,
                  type: QueryEditorPropertyType.String,
                },
              })
            }
          />
        </>
      ) : (
        <></>
      )}
      <AccessoryButton aria-label="remove" icon="times" variant="secondary" onClick={onDelete} />
    </InputGroup>
  );
};

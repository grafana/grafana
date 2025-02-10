import React from 'react';

import { SelectableValue } from '@grafana/data';
import { AccessoryButton, InputGroup } from '@grafana/plugin-ui';
import { Select } from '@grafana/ui';

import { QueryEditorPropertyType } from '../../types';

import { QueryEditorExpressionType, QueryEditorReduceExpression } from './expressions';
import { valueToDefinition } from './utils';

interface AggregateItemProps {
  aggregate: Partial<QueryEditorReduceExpression>;
  columns: Array<SelectableValue<string>>;
  onChange: (item: QueryEditorReduceExpression) => void;
  onDelete: () => void;
}

export const AggregateItem: React.FC<AggregateItemProps> = ({ aggregate, onChange, onDelete, columns }) => {
  const selectedColumn = columns.find((c) => c.value === aggregate.property?.name);
  const columnType = selectedColumn?.type || QueryEditorPropertyType.String;

  let availableAggregates: Array<SelectableValue<string>> = [];

  switch (columnType) {
    case QueryEditorPropertyType.Number:
      availableAggregates = [
        { label: 'sum', value: 'sum' },
        { label: 'avg', value: 'avg' },
        { label: 'min', value: 'min' },
        { label: 'max', value: 'max' },
        { label: 'percentile', value: 'percentile' },
      ];
      break;
    case QueryEditorPropertyType.String:
      availableAggregates = [
        { label: 'count', value: 'count' },
        { label: 'dcount', value: 'dcount' },
        { label: 'make_set', value: 'make_set' },
        { label: 'make_list', value: 'make_list' },
      ];
      break;
    case QueryEditorPropertyType.DateTime:
      availableAggregates = [
        { label: 'min', value: 'min' },
        { label: 'max', value: 'max' },
        { label: 'bin', value: 'bin' },
      ];
      break;
  }

  return (
    <InputGroup>
      <Select
        aria-label="column"
        width="auto"
        value={aggregate.property?.name ? valueToDefinition(aggregate.property?.name) : null}
        options={columns}
        allowCustomValue
        onChange={(e) => {
          const selectedCol = columns.find((c) => c.value === e.value);
          onChange({
            ...aggregate,
            property: {
              name: e.value!,
              type: selectedCol?.type || QueryEditorPropertyType.String,
            },
            reduce: aggregate.reduce ?? { name: '', type: QueryEditorPropertyType.Function }, // Ensure `reduce` is always defined
            type: QueryEditorExpressionType.Reduce, // Ensure `type` is always defined
          });
        }}
      />
      <Select
        aria-label="aggregate function"
        width="auto"
        value={aggregate.reduce?.name ? valueToDefinition(aggregate.reduce?.name) : null}
        options={availableAggregates}
        allowCustomValue
        onChange={(e) =>
          e.value &&
          onChange({
            ...aggregate,
            type: QueryEditorExpressionType.Reduce,
            property: aggregate.property ?? { name: '', type: QueryEditorPropertyType.String },
            reduce: { name: e.value, type: QueryEditorPropertyType.Function },
          })
        }
      />
      <AccessoryButton aria-label="remove" icon="times" variant="secondary" onClick={onDelete} />
    </InputGroup>
  );
};

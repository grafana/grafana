import React, { useMemo } from 'react';

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

  const mapColumnType = (type: string): QueryEditorPropertyType => {
    switch (type.toLowerCase()) {
      case 'number':
      case 'int':
      case 'float':
      case 'double':
        return QueryEditorPropertyType.Number;
      case 'string':
      case 'text':
        return QueryEditorPropertyType.String;
      case 'datetime':
      case 'timestamp':
        return QueryEditorPropertyType.DateTime;
      default:
        return QueryEditorPropertyType.String;
    }
  };

  const columnType = selectedColumn ? mapColumnType(selectedColumn.type || '') : QueryEditorPropertyType.String;

  const availableAggregates: Array<SelectableValue<string>> = useMemo(() => {
    const allAggregates = [
      { label: 'sum', value: 'sum' },
      { label: 'avg', value: 'avg' },
      { label: 'min', value: 'min' },
      { label: 'max', value: 'max' },
      { label: 'percentile', value: 'percentile' },
      { label: 'count', value: 'count' },
      { label: 'dcount', value: 'dcount' },
      { label: 'make_set', value: 'make_set' },
      { label: 'make_list', value: 'make_list' },
      { label: 'bin', value: 'bin' },
    ];

    if (!selectedColumn) {
      return allAggregates;
    }

    return allAggregates.filter((agg) => {
      const aggValue = agg.value;
      if (columnType === QueryEditorPropertyType.Number) {
        return ['sum', 'avg', 'min', 'max', 'percentile'].includes(aggValue);
      }
      if (columnType === QueryEditorPropertyType.String) {
        return ['count', 'dcount', 'make_set', 'make_list'].includes(aggValue);
      }
      if (columnType === QueryEditorPropertyType.DateTime) {
        return ['min', 'max', 'bin'].includes(aggValue);
      }
      return true;
    });
  }, [selectedColumn, columnType]);

  return (
    <InputGroup>
      <Select
        aria-label="column"
        width="auto"
        value={aggregate.property?.name ? valueToDefinition(aggregate.property?.name) : null}
        options={columns}
        allowCustomValue
        onChange={(e) =>
          onChange({
            ...aggregate,
            property: { name: e.value!, type: columnType },
            reduce: aggregate.reduce ?? { name: '', type: QueryEditorPropertyType.Function },
            type: aggregate.type ?? QueryEditorExpressionType.Reduce,
          })
        }
      />
      <Select
        aria-label="aggregate function"
        width="auto"
        value={aggregate.reduce?.name ? valueToDefinition(aggregate.reduce?.name) : null}
        options={availableAggregates}
        allowCustomValue
        onChange={(e) =>
          onChange({
            ...aggregate,
            property: aggregate.property ?? { name: '', type: QueryEditorPropertyType.String },
            reduce: { name: e.value!, type: QueryEditorPropertyType.Function },
            type: aggregate.type ?? QueryEditorExpressionType.Reduce,
          })
        }
      />
      <AccessoryButton aria-label="remove" icon="times" variant="secondary" onClick={onDelete} />
    </InputGroup>
  );
};

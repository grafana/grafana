import React, { useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { AccessoryButton, InputGroup } from '@grafana/plugin-ui';
import { Select } from '@grafana/ui';

import { BuilderQueryEditorReduceExpression, BuilderQueryEditorPropertyType } from '../../dataquery.gen';

import { valueToDefinition } from './utils';

interface AggregateItemProps {
  aggregate: Partial<BuilderQueryEditorReduceExpression>;
  columns: Array<SelectableValue<string>>;
  onChange: (item: BuilderQueryEditorReduceExpression) => void;
  onDelete: () => void;
}

export const AggregateItem: React.FC<AggregateItemProps> = ({ aggregate, onChange, onDelete, columns }) => {
  const selectedColumn = columns.find((c) => c.value === aggregate.property?.name);

  const mapColumnType = (type: string): BuilderQueryEditorPropertyType => {
    switch (type.toLowerCase()) {
      case 'number':
      case 'int':
      case 'float':
      case 'double':
        return BuilderQueryEditorPropertyType.Number;
      case 'string':
      case 'text':
        return BuilderQueryEditorPropertyType.String;
      case 'datetime':
      case 'timestamp':
        return BuilderQueryEditorPropertyType.Datetime;
      default:
        return BuilderQueryEditorPropertyType.String;
    }
  };

  const columnType = selectedColumn ? mapColumnType(selectedColumn.type || '') : BuilderQueryEditorPropertyType.String;

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
      if (columnType === BuilderQueryEditorPropertyType.Number) {
        return ['sum', 'avg', 'min', 'max', 'percentile'].includes(aggValue);
      }
      if (columnType === BuilderQueryEditorPropertyType.String) {
        return ['count', 'dcount', 'make_set', 'make_list'].includes(aggValue);
      }
      if (columnType === BuilderQueryEditorPropertyType.Datetime) {
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
            reduce: aggregate.reduce ?? { name: '', type: BuilderQueryEditorPropertyType.Function },
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
            property: aggregate.property ?? { name: '', type: BuilderQueryEditorPropertyType.String },
            reduce: { name: e.value!, type: BuilderQueryEditorPropertyType.Function },
          })
        }
      />
      <AccessoryButton aria-label="remove" icon="times" variant="secondary" onClick={onDelete} />
    </InputGroup>
  );
};

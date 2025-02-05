import React from 'react';

import { SelectableValue } from '@grafana/data';
import { AccessoryButton, InputGroup } from '@grafana/plugin-ui';
import { Select } from '@grafana/ui';

import {
  QueryEditorExpressionType,
  QueryEditorGroupByExpression,
  QueryEditorPropertyType,
  toPropertyType,
  valueToDefinition,
} from './utils';

interface GroupByItemProps {
  groupBy: Partial<QueryEditorGroupByExpression>;
  columns: Array<SelectableValue<string>>;
  onChange: (item: QueryEditorGroupByExpression) => void;
  onDelete: () => void;
}

export const GroupByItem: React.FC<GroupByItemProps> = ({ groupBy, onChange, onDelete, columns }) => {
  const columnOptions = columns.length
    ? columns.map((c) => ({ label: c.label, value: c.value }))
    : [{ label: 'No columns available', value: '' }]; // 🚀 Always show an option

  return (
    <InputGroup>
      <Select
        aria-label="column"
        width="auto"
        autoFocus={groupBy.focus}
        value={groupBy.property?.name ? valueToDefinition(groupBy.property?.name) : null}
        options={columnOptions}
        allowCustomValue
        onChange={(e) => {
          if (!e.value) {
            return
          }

          const selectedColumn = columns.find((c) => c.value === e.value);
          onChange({
            property: {
              name: e.value!,
              type: selectedColumn?.type
                ? toPropertyType(selectedColumn.type)
                : QueryEditorPropertyType.String,
            },
            interval: groupBy.interval,
            type: QueryEditorExpressionType.GroupBy,
          });
        }}
      />
      <>
        {groupBy.property?.type === QueryEditorPropertyType.DateTime && (
          <Select
            width={'auto'}
            aria-label="interval"
            allowCustomValue
            options={[
              { label: 'auto', value: '$__timeInterval' },
              { label: '1 minute', value: '1m' },
              { label: '5 minutes', value: '5m' },
              { label: '15 minutes', value: '15m' },
              { label: '30 minutes', value: '30m' },
              { label: '1 hour', value: '1h' },
              { label: '6 hours', value: '6h' },
              { label: '12 hours', value: '12h' },
              { label: '1 day', value: '1d' },
            ]}
            value={groupBy.interval?.name}
            onChange={(e) => {
              e.value &&
                onChange({
                  interval: {
                    name: e.value,
                    type: QueryEditorPropertyType.Interval,
                  },
                  property: groupBy.property ?? {
                    name: '',
                    type: QueryEditorPropertyType.String,
                  },
                  type: QueryEditorExpressionType.GroupBy,
                });
            }}
          />
        )}
      </>
      <AccessoryButton aria-label="remove" icon="times" variant="secondary" onClick={onDelete} />
    </InputGroup>
  );
};

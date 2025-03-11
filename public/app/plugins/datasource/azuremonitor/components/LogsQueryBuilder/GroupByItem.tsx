import React from 'react';

import { SelectableValue } from '@grafana/data';
import { AccessoryButton, InputGroup } from '@grafana/plugin-ui';
import { Select } from '@grafana/ui';

import { BuilderQueryEditorGroupByExpression, BuilderQueryEditorPropertyType, BuilderQueryEditorExpressionType } from '../../dataquery.gen';

import { valueToDefinition } from './utils';

interface GroupByItemProps {
  groupBy: Partial<BuilderQueryEditorGroupByExpression>;
  columns: Array<SelectableValue<string>>;
  onChange: (item: BuilderQueryEditorGroupByExpression) => void;
  onDelete: () => void;
}

export const GroupByItem: React.FC<GroupByItemProps> = ({ groupBy, onChange, onDelete, columns }) => {
  const columnOptions =
    columns.length > 0
      ? columns.map((c) => ({ label: c.label, value: c.value }))
      : [{ label: 'No columns available', value: '' }];

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
            return;
          }

          const selectedColumn = columns.find((c) => c.value === e.value);
          onChange({
            property: {
              name: e.value!,
              type: selectedColumn?.type ? BuilderQueryEditorPropertyType.String : BuilderQueryEditorPropertyType.String,  // Default to BuilderQueryEditorPropertyType.String or handle conversion here
            },
            interval: groupBy.interval,
            type: BuilderQueryEditorExpressionType.Group_by,
          });          
        }}
      />
      <AccessoryButton aria-label="remove" icon="times" variant="secondary" onClick={onDelete} />
    </InputGroup>
  );
};

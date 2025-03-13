import React from 'react';

import { SelectableValue } from '@grafana/data';
import { AccessoryButton, InputGroup } from '@grafana/plugin-ui';
import { Select } from '@grafana/ui';

import {
  BuilderQueryEditorGroupByExpression,
  BuilderQueryEditorPropertyType,
  BuilderQueryEditorExpressionType,
} from '../../dataquery.gen';

interface GroupByItemProps {
  groupBy: Partial<BuilderQueryEditorGroupByExpression>;
  columns: Array<SelectableValue<string>>;
  onChange: (item: BuilderQueryEditorGroupByExpression) => void;
  onDelete: () => void;
  templateVariableOptions: SelectableValue<string>;
}

export const GroupByItem: React.FC<GroupByItemProps> = ({ groupBy, onChange, onDelete, columns, templateVariableOptions }) => {
  const columnOptions: SelectableValue<string> =
    columns.length > 0
      ? columns.map((c) => ({ label: c.label, value: c.value }))
      : [{ label: 'No columns available', value: '' }];

  const handleChange = (selectedValue: SelectableValue<string>) => {
    if (!selectedValue.value) {
      return;
    }

    const selectedColumn = columns.find((c) => c.value === selectedValue.value);

    onChange({
      ...groupBy,
      property: {
        name: selectedValue.value,
        type: selectedColumn?.type || BuilderQueryEditorPropertyType.String,
      },
      interval: groupBy.interval,
      type: BuilderQueryEditorExpressionType.Group_by,
    });
  };

  return (
    <InputGroup>
      <Select
        aria-label="column"
        width="auto"
        value={groupBy.property?.name ? { label: groupBy.property.name, value: groupBy.property.name } : null}
        options={columnOptions.concat(templateVariableOptions)}
        allowCustomValue
        onChange={handleChange}
      />
      <AccessoryButton aria-label="remove" icon="times" variant="secondary" onClick={onDelete} />
    </InputGroup>
  );
};

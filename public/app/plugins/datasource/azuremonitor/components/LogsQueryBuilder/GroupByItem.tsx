import React from 'react';

import { SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { AccessoryButton, InputGroup } from '@grafana/plugin-ui';
import { Select } from '@grafana/ui';

import {
  BuilderQueryEditorGroupByExpression,
  BuilderQueryEditorPropertyType,
  BuilderQueryEditorExpressionType,
} from '../../dataquery.gen';
import { AzureMonitorOption } from '../../types';
import { addValueToOptions } from '../../utils/common';

import { inputFieldSize } from './utils';

interface GroupByItemProps {
  groupBy: BuilderQueryEditorGroupByExpression;
  columns: Array<SelectableValue<string>>;
  onChange: (item: BuilderQueryEditorGroupByExpression) => void;
  onDelete: () => void;
  variableOptionGroup: { label: string; options: AzureMonitorOption[] };
}

export const GroupByItem: React.FC<GroupByItemProps> = ({
  groupBy,
  onChange,
  onDelete,
  columns,
  variableOptionGroup,
}) => {
  const columnOptions: Array<SelectableValue<string>> =
    columns.length > 0
      ? columns.map((c) => ({ label: c.label, value: c.value }))
      : [{ label: 'No columns available', value: '' }];

  const selectableOptions = addValueToOptions(columnOptions, variableOptionGroup, groupBy.property?.name);

  const handleChange = (selectedValue: SelectableValue<string>) => {
    if (!selectedValue.value) {
      return;
    }

    const isTemplateVariable = selectedValue.value.startsWith('$');
    const selectedColumn = columns.find((c) => c.value === selectedValue.value);

    onChange({
      ...groupBy,
      property: {
        name: selectedValue.value,
        type: isTemplateVariable
          ? BuilderQueryEditorPropertyType.String
          : selectedColumn?.type || BuilderQueryEditorPropertyType.String,
      },
      interval: groupBy.interval,
      type: BuilderQueryEditorExpressionType.Group_by,
    });
  };

  return (
    <InputGroup>
      <Select
        aria-label={t('components.group-by-item.aria-label-column', 'Column')}
        width={inputFieldSize}
        value={groupBy.property?.name ? { label: groupBy.property.name, value: groupBy.property.name } : null}
        options={selectableOptions}
        allowCustomValue
        onChange={handleChange}
      />
      <AccessoryButton
        aria-label={t('components.group-by-item.aria-label-remove', 'Remove')}
        icon="times"
        variant="secondary"
        onClick={onDelete}
      />
    </InputGroup>
  );
};

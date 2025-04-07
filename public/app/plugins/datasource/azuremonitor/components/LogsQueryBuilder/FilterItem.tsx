import React from 'react';

import { SelectableValue } from '@grafana/data';
import { Button, Combobox, ComboboxOption, Label, Select } from '@grafana/ui';

import { BuilderQueryEditorWhereExpressionItems } from '../../dataquery.gen';

import { inputFieldSize, toOperatorOptions, valueToDefinition } from './utils';

interface FilterItemProps {
  filter: BuilderQueryEditorWhereExpressionItems;
  filterIndex: number;
  groupIndex: number;
  usedColumns: string[];
  selectableOptions: Array<SelectableValue<string>>;
  onChange: (groupIndex: number, field: 'property' | 'operator' | 'value', value: string, filterIndex: number) => void;
  onDelete: (groupIndex: number, filterIndex: number) => void;
  getFilterValues: (
    filter: BuilderQueryEditorWhereExpressionItems,
    inputValue: string
  ) => Promise<Array<ComboboxOption<string>>>;
  showOr: boolean;
}

export const FilterItem: React.FC<FilterItemProps> = ({
  filter,
  filterIndex,
  groupIndex,
  usedColumns,
  selectableOptions,
  onChange,
  onDelete,
  getFilterValues,
  showOr,
}) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <Select
        aria-label="column"
        width={inputFieldSize}
        value={valueToDefinition(filter.property.name)}
        options={selectableOptions.filter((opt) => !usedColumns.includes(opt.value!))}
        onChange={(e) => e.value && onChange(groupIndex, 'property', e.value, filterIndex)}
      />
      <Select
        aria-label="operator"
        width={12}
        value={{ label: filter.operator.name, value: filter.operator.name }}
        options={toOperatorOptions('string')}
        onChange={(e) => e.value && onChange(groupIndex, 'operator', e.value, filterIndex)}
      />
      <Combobox
        aria-label="column value"
        value={
          filter.operator.value
            ? {
                label: String(filter.operator.value),
                value: String(filter.operator.value),
              }
            : null
        }
        options={(inputValue: string) => getFilterValues(filter, inputValue)}
        onChange={(e) => e.value && onChange(groupIndex, 'value', String(e.value), filterIndex)}
        width={inputFieldSize}
        disabled={!filter.property?.name}
      />
      <Button variant="secondary" icon="times" onClick={() => onDelete(groupIndex, filterIndex)} />
      {showOr && <Label style={{ padding: '9px 14px' }}>OR</Label>}
    </div>
  );
};

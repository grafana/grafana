import React, { FC } from 'react';
import { createFilter, GroupBase, OptionsOrGroups } from 'react-select';

import { SelectableValue } from '@grafana/data';
import { Field, Select } from '@grafana/ui';

export interface AlertLabelDropdownProps {
  onChange: (newValue: SelectableValue<string>) => void;
  onOpenMenu?: () => void;
  options: SelectableValue[];
  defaultValue?: SelectableValue;
  type: 'key' | 'value';
}
const _customFilter = createFilter({ ignoreCase: false });
function customFilter(opt: SelectableValue, searchQuery: string) {
  return _customFilter(
    {
      label: opt.label ?? '',
      value: opt.value ?? '',
      data: {},
    },
    searchQuery
  );
}

const handleIsValidNewOption = (
  inputValue: string,
  value: SelectableValue<string> | null,
  options: OptionsOrGroups<SelectableValue<string>, GroupBase<SelectableValue<string>>>
) => {
  const exactValueExists = options.some((el) => el.label === inputValue);
  const valueIsNotEmpty = inputValue.trim().length;
  return !Boolean(exactValueExists) && Boolean(valueIsNotEmpty);
};

const AlertLabelDropdown: FC<AlertLabelDropdownProps> = React.forwardRef<HTMLDivElement, AlertLabelDropdownProps>(
  function labelPicker({ onChange, options, defaultValue, type, onOpenMenu = () => {} }, ref) {
    return (
      <div ref={ref}>
        <Field disabled={false} data-testid={`alertlabel-${type}-picker`}>
          <Select<string>
            placeholder={`Choose ${type}`}
            width={29}
            className="ds-picker select-container"
            backspaceRemovesValue={false}
            onChange={onChange}
            onOpenMenu={onOpenMenu}
            filterOption={customFilter}
            isValidNewOption={handleIsValidNewOption}
            options={options}
            maxMenuHeight={500}
            noOptionsMessage="No labels found"
            defaultValue={defaultValue}
            allowCustomValue
          />
        </Field>
      </div>
    );
  }
);

export default AlertLabelDropdown;

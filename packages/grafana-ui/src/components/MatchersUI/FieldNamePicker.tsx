import React, { useCallback } from 'react';

import { FieldNamePickerConfigSettings, SelectableValue, StandardEditorProps } from '@grafana/data';

import { Select } from '../Select/Select';

import { useFieldDisplayNames, useSelectOptions, frameHasName } from './utils';

// Pick a field name out of the fields
export const FieldNamePicker: React.FC<StandardEditorProps<string, FieldNamePickerConfigSettings>> = ({
  value,
  onChange,
  context,
  item,
}) => {
  const settings: FieldNamePickerConfigSettings = item.settings ?? {};
  const names = useFieldDisplayNames(context.data, settings?.filter);
  const selectOptions = useSelectOptions(names, value);

  const onSelectChange = useCallback(
    (selection?: SelectableValue<string>) => {
      if (selection && !frameHasName(selection.value, names)) {
        return; // can not select name that does not exist?
      }
      return onChange(selection?.value);
    },
    [names, onChange]
  );

  const selectedOption = selectOptions.find((v) => v.value === value);
  return (
    <>
      <Select
        value={selectedOption}
        placeholder={settings.placeholderText ?? 'Select field'}
        options={selectOptions}
        onChange={onSelectChange}
        noOptionsMessage={settings.noFieldsMessage}
        width={settings.width}
        isClearable={true}
      />
    </>
  );
};

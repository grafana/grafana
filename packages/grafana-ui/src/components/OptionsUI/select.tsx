import React from 'react';
import { FieldConfigEditorProps, SelectFieldConfigSettings, SelectableValue } from '@grafana/data';
import { Select } from '../Select/Select';

export function SelectValueEditor<T>({
  value,
  onChange,
  item,
  context,
}: FieldConfigEditorProps<T, SelectFieldConfigSettings<T>>) {
  const { settings } = item;
  const { getOptions, allowCustomValue } = settings;
  let options: Array<SelectableValue<T>> = item.settings?.options || [];
  if (getOptions) {
    options = getOptions(context);
  }
  let current = options.find(v => v.value === value);
  if (!current && value) {
    current = {
      label: `${value}`,
      value,
    };
  }
  return (
    <Select<T>
      value={current}
      defaultValue={value}
      allowCustomValue={allowCustomValue}
      onChange={e => onChange(e.value)}
      options={options}
    />
  );
}

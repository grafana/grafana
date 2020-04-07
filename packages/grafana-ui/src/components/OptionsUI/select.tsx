import React from 'react';
import { FieldConfigEditorProps, SelectFieldConfigSettings } from '@grafana/data';
import { Select } from '../Select/Select';

export function SelectValueEditor<T>({
  value,
  onChange,
  item,
}: FieldConfigEditorProps<T, SelectFieldConfigSettings<T>>) {
  return <Select<T> defaultValue={value} onChange={e => onChange(e.value)} options={item.settings?.options} />;
}

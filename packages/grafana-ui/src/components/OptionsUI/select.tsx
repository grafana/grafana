import React from 'react';
import { FieldConfigEditorProps, SelectFieldConfigSettings } from '@grafana/data';
import Forms from '../Forms';

export function SelectValueEditor<T>({
  value,
  onChange,
  item,
}: FieldConfigEditorProps<T, SelectFieldConfigSettings<T>>) {
  return <Forms.Select<T> defaultValue={value} onChange={e => onChange(e.value)} options={item.settings.options} />;
}

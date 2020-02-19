import React, { FC } from 'react';

import { FieldOverrideContext, FieldOverrideEditorProps, FieldConfigEditorProps, SelectableValue } from '@grafana/data';
import Forms from '../Forms';

export interface SelectFieldConfigSettings<T> {
  options: Array<SelectableValue<T>>;
}

export const selectOverrideProcessor = (
  value: any,
  context: FieldOverrideContext,
  settings: SelectFieldConfigSettings<any>
) => {
  return value;
};

export const SelectValueEditor: FC<FieldConfigEditorProps<string, SelectFieldConfigSettings<any>>> = ({
  item,
  value,
  onChange,
}) => {
  return <Forms.Select value={value || ''} onChange={e => onChange(e.value)} options={item.settings.options} />;
};

export const SelectOverrideEditor: FC<FieldOverrideEditorProps<string, SelectFieldConfigSettings<any>>> = ({
  item,
  value,
  onChange,
}) => {
  return <Forms.Select value={value || ''} onChange={e => onChange(e.value)} options={item.settings.options} />;
};

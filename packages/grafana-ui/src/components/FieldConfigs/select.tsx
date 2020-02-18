import React, { FC } from 'react';

import { FieldOverrideContext, FieldOverrideEditorProps, FieldConfigEditorProps, SelectableValue } from '@grafana/data';
import Forms from '../Forms';

export interface StringSelectFieldConfigSettings {
  options: Array<SelectableValue<string>>;
}

export const stringSelectOverrideProcessor = (
  value: any,
  context: FieldOverrideContext,
  settings: StringSelectFieldConfigSettings
) => {
  return String(value);
};

export const StringSelectValueEditor: FC<FieldConfigEditorProps<string, StringSelectFieldConfigSettings>> = ({
  item,
  value,
  onChange,
}) => {
  return <Forms.Select value={value || ''} onChange={e => onChange(e.value)} options={item.settings.options} />;
};

export const StringSelectOverrideEditor: FC<FieldOverrideEditorProps<string, StringSelectFieldConfigSettings>> = ({
  item,
  value,
  onChange,
}) => {
  return <Forms.Select value={value || ''} onChange={e => onChange(e.value)} options={item.settings.options} />;
};

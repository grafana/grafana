import React from 'react';

import { FieldOverrideEditorProps, FieldConfigEditorProps } from '@grafana/data';
import { UnitPicker } from '../UnitPicker/UnitPicker';

export interface UnitFieldConfigSettings {
  // ??
}

export const UnitValueEditor: React.FC<FieldConfigEditorProps<string, UnitFieldConfigSettings>> = ({
  value,
  onChange,
}) => {
  return <UnitPicker value={value} onChange={onChange} useNewForms />;
};

export const UnitOverrideEditor: React.FC<FieldOverrideEditorProps<string, UnitFieldConfigSettings>> = ({
  value,
  onChange,
}) => {
  return <UnitPicker value={value} onChange={onChange} useNewForms />;
};

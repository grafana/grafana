import React from 'react';

import { FieldConfigEditorProps, UnitFieldConfigSettings } from '@grafana/data';
import { UnitPicker } from '../UnitPicker/UnitPicker';

export const UnitValueEditor: React.FC<FieldConfigEditorProps<string, UnitFieldConfigSettings>> = ({
  value,
  onChange,
}) => {
  return <UnitPicker value={value} onChange={onChange} useNewForms />;
};

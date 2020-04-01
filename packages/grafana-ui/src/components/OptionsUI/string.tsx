import React from 'react';
import { FieldConfigEditorProps, StringFieldConfigSettings } from '@grafana/data';
import Forms from '../Forms';

export const StringValueEditor: React.FC<FieldConfigEditorProps<string, StringFieldConfigSettings>> = ({
  value,
  onChange,
}) => {
  return <Forms.Input value={value || ''} onChange={e => onChange(e.currentTarget.value)} />;
};

import React from 'react';
import { FieldConfigEditorProps, StringFieldConfigSettings } from '@grafana/data';
import { Input } from '../Input/Input';

export const StringValueEditor: React.FC<FieldConfigEditorProps<string, StringFieldConfigSettings>> = ({
  value,
  onChange,
  item,
}) => {
  return (
    <Input
      placeholder={item.settings?.placeholder}
      value={value || ''}
      onChange={e => onChange(e.currentTarget.value)}
    />
  );
};

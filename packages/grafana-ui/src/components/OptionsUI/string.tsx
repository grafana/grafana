import React from 'react';
import { FieldConfigEditorProps, StringFieldConfigSettings } from '@grafana/data';
import { Input } from '../Input/Input';
import { TextArea } from '../TextArea/TextArea';

export const StringValueEditor: React.FC<FieldConfigEditorProps<string, StringFieldConfigSettings>> = ({
  value,
  onChange,
  item,
}) => {
  const Component = item.settings?.useTextarea ? TextArea : Input;
  return (
    <Component
      placeholder={item.settings?.placeholder}
      value={value || ''}
      rows={item.settings?.useTextarea && item.settings.rows}
      onChange={(e: React.FormEvent<any>) => onChange(e.currentTarget.value)}
    />
  );
};

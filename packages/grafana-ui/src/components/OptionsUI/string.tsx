import React, { useCallback } from 'react';
import { FieldConfigEditorProps, StringFieldConfigSettings } from '@grafana/data';
import { Input } from '../Input/Input';
import { TextArea } from '../TextArea/TextArea';

export const StringValueEditor: React.FC<FieldConfigEditorProps<string, StringFieldConfigSettings>> = ({
  value,
  onChange,
  item,
}) => {
  const Component = item.settings?.useTextarea ? TextArea : Input;
  const onValueChange = useCallback(
    (value: string) => {
      onChange(value.trim() === '' ? undefined : value);
    },
    [onChange]
  );
  return (
    <Component
      placeholder={item.settings?.placeholder}
      defaultValue={value || ''}
      rows={item.settings?.useTextarea && item.settings.rows}
      onBlur={(e: React.FormEvent<any>) => onValueChange(e.currentTarget.value)}
      onKeyDown={(e: React.KeyboardEvent<any>) => {
        if (!item.settings?.useTextarea && e.key === 'Enter') {
          onValueChange(e.currentTarget.value);
        }
      }}
    />
  );
};

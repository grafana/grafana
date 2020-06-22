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
    (e: React.SyntheticEvent) => {
      if (e.hasOwnProperty('key')) {
        // handling keyboard event
        const evt = e as React.KeyboardEvent<HTMLInputElement>;
        if (evt.key === 'Enter' && !item.settings?.useTextarea) {
          onChange(evt.currentTarget.value.trim() === '' ? undefined : evt.currentTarget.value);
        }
      } else {
        // handling form event
        const evt = e as React.FormEvent<HTMLInputElement>;
        onChange(evt.currentTarget.value.trim() === '' ? undefined : evt.currentTarget.value);
      }
    },
    [onChange]
  );

  return (
    <Component
      placeholder={item.settings?.placeholder}
      defaultValue={value || ''}
      rows={item.settings?.useTextarea && item.settings.rows}
      onBlur={onValueChange}
      onKeyDown={onValueChange}
    />
  );
};

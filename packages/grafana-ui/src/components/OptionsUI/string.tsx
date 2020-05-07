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
        if ((e as React.KeyboardEvent).key === 'Enter' && !item.settings?.useTextarea) {
          onChange((e as React.KeyboardEvent).currentTarget.value.trim() === '' ? undefined : e.currentTarget.value);
        }
      } else {
        // handling form event
        onChange(
          (e as React.FormEvent<HTMLInputElement>).currentTarget.value.trim() === '' ? undefined : e.currentTarget.value
        );
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

import React, { ReactNode, useCallback } from 'react';

import { StandardEditorProps, StringFieldConfigSettings } from '@grafana/data';
import { Input, TextArea } from '@grafana/ui';

interface Props extends StandardEditorProps<string, StringFieldConfigSettings> {
  suffix?: ReactNode;
}

export const StringValueEditor = ({ value, onChange, item, suffix }: Props) => {
  const Component = item.settings?.useTextarea ? TextArea : Input;
  const onValueChange = useCallback(
    (e: React.SyntheticEvent) => {
      let nextValue = value ?? '';
      if (e.hasOwnProperty('key')) {
        // handling keyboard event
        const evt = e as React.KeyboardEvent<HTMLInputElement>;
        if (evt.key === 'Enter' && !item.settings?.useTextarea) {
          nextValue = evt.currentTarget.value.trim();
        }
      } else {
        // handling form event
        const evt = e as React.FormEvent<HTMLInputElement>;
        nextValue = evt.currentTarget.value.trim();
      }
      if (nextValue === value) {
        return; // no change
      }
      onChange(nextValue === '' ? undefined : nextValue);
    },
    [value, item.settings?.useTextarea, onChange]
  );

  return (
    <Component
      placeholder={item.settings?.placeholder}
      defaultValue={value || ''}
      rows={(item.settings?.useTextarea && item.settings.rows) || 5}
      onBlur={onValueChange}
      onKeyDown={onValueChange}
      suffix={suffix}
    />
  );
};

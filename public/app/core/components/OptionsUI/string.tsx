import { ReactNode, useCallback } from 'react';
import * as React from 'react';

import { StandardEditorProps, StringFieldConfigSettings } from '@grafana/data';
import { Input, TextArea } from '@grafana/ui';

interface Props extends StandardEditorProps<string, StringFieldConfigSettings> {
  suffix?: ReactNode;
  preserveWhitespace?: boolean;
}

export const StringValueEditor = ({ value, onChange, item, suffix, preserveWhitespace}: Props) => {
  const Component = item.settings?.useTextarea ? TextArea : Input;
  const onValueChange = useCallback(
    (
      e:
        | React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
        | React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
      let nextValue = value ?? '';
      if ('key' in e) {
        // handling keyboard event
        if (e.key === 'Enter' && !item.settings?.useTextarea) {
          nextValue = (preserveWhitespace ?? false) ? e.currentTarget.value : e.currentTarget.value.trim();
        }
      } else {
        // handling blur event
        nextValue = (preserveWhitespace ?? false) ? e.currentTarget.value : e.currentTarget.value.trim();
      }
      if (nextValue === value) {
        return; // no change
      }
      onChange(nextValue === '' ? undefined : nextValue);
    },
    [value, item.settings?.useTextarea, onChange, preserveWhitespace]
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

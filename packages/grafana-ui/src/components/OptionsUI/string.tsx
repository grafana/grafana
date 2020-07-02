import React, { useCallback, useMemo } from 'react';
import {
  FieldConfigEditorProps,
  StringFieldConfigSettings,
  StringFieldWithSuggestionsConfigSettings,
  VariableSuggestionsScope,
} from '@grafana/data';
import { Input } from '../Input/Input';
import { TextArea } from '../TextArea/TextArea';
import { DataLinkInput } from '..';

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

export const StringWithSuggestionsValueEditor: React.FC<FieldConfigEditorProps<string, StringFieldConfigSettings>> = ({
  value,
  onChange,
  item,
  context,
}) => {
  const suggestions = useMemo(() => {
    return context.getSuggestions ? context.getSuggestions(VariableSuggestionsScope.Values) : [];
  }, [context.getSuggestions]);

  return (
    <DataLinkInput
      suggestions={suggestions}
      placeholder={item.settings?.placeholder}
      value={value || ''}
      onChange={onChange}
    />
  );
};

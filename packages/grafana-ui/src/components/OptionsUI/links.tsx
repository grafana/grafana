import React from 'react';
import {
  DataLinkExternal,
  DataLinksFieldConfigSettings,
  FieldConfigEditorProps,
  VariableSuggestionsScope,
} from '@grafana/data';
import { DataLinksInlineEditor } from '../DataLinks/DataLinksInlineEditor/DataLinksInlineEditor';

export const DataLinksValueEditor: React.FC<FieldConfigEditorProps<
  DataLinkExternal[],
  DataLinksFieldConfigSettings
>> = ({ value, onChange, context }) => {
  return (
    <DataLinksInlineEditor
      links={value}
      onChange={onChange}
      data={context.data}
      suggestions={context.getSuggestions ? context.getSuggestions(VariableSuggestionsScope.Values) : []}
    />
  );
};

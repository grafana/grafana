import React from 'react';

import {
  DataLink,
  DataLinksFieldConfigSettings,
  FieldConfigEditorProps,
  VariableSuggestionsScope,
} from '@grafana/data';
import { DataLinksInlineEditor } from '@grafana/ui';

type Props = FieldConfigEditorProps<DataLink[], DataLinksFieldConfigSettings>;

export const DataLinksValueEditor = ({ value, onChange, context }: Props) => {
  return (
    <DataLinksInlineEditor
      links={value}
      onChange={onChange}
      data={context.data}
      getSuggestions={() => (context.getSuggestions ? context.getSuggestions(VariableSuggestionsScope.Values) : [])}
    />
  );
};

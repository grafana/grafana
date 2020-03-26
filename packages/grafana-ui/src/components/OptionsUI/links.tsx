import React from 'react';
import { FieldConfigEditorProps, DataLink, DataLinksFieldConfigSettings } from '@grafana/data';
import { DataLinksInlineEditor } from '../DataLinks/DataLinksInlineEditor/DataLinksInlineEditor';

export const DataLinksValueEditor: React.FC<FieldConfigEditorProps<DataLink[], DataLinksFieldConfigSettings>> = ({
  value,
  onChange,
  context,
}) => {
  return (
    <DataLinksInlineEditor
      links={value}
      onChange={onChange}
      data={context.data}
      suggestions={context.getSuggestions ? context.getSuggestions() : []}
    />
  );
};

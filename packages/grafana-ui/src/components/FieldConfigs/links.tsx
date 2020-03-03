import { FieldOverrideContext, FieldConfigEditorProps, DataLink, FieldOverrideEditorProps } from '@grafana/data';
import React from 'react';
import { DataLinksInlineEditor } from '../DataLinks/DataLinksInlineEditor/DataLinksInlineEditor';

export interface DataLinksFieldConfigSettings {}

export const dataLinksOverrideProcessor = (
  value: any,
  context: FieldOverrideContext,
  _settings: DataLinksFieldConfigSettings
) => {
  return value as DataLink[];
};

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

export const DataLinksOverrideEditor: React.FC<FieldOverrideEditorProps<DataLink[], DataLinksFieldConfigSettings>> = ({
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

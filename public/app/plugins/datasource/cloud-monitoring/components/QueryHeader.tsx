import React from 'react';

import { EditorHeader, FlexItem, InlineSelect } from '@grafana/experimental';
import { RadioButtonGroup } from '@grafana/ui';

import { QUERY_TYPES } from '../constants';
import { EditorMode, CloudMonitoringQuery, QueryType } from '../types';

export interface QueryEditorHeaderProps {
  editorMode: EditorMode;
  query: CloudMonitoringQuery;
  onChange: (value: CloudMonitoringQuery) => void;
  onRunQuery: () => void;
  setEditorMode: (value: EditorMode) => void;
}

const EDITOR_MODES = [
  { label: 'Builder', value: EditorMode.Visual },
  { label: 'MQL', value: EditorMode.MQL },
];

export const QueryHeader = (props: QueryEditorHeaderProps) => {
  const { query, onChange, onRunQuery, editorMode, setEditorMode } = props;
  const { queryType } = query;

  return (
    <EditorHeader>
      <InlineSelect
        label="Query type"
        options={QUERY_TYPES}
        value={queryType}
        onChange={({ value }) => {
          onChange({ ...query, queryType: value! });
          onRunQuery();
        }}
      />
      <FlexItem grow={1} />
      {queryType !== QueryType.SLO && (
        <RadioButtonGroup size="sm" options={EDITOR_MODES} value={editorMode} onChange={setEditorMode} />
      )}
    </EditorHeader>
  );
};

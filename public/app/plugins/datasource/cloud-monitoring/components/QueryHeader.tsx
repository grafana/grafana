import React from 'react';

import { EditorHeader, FlexItem, InlineSelect } from '@grafana/experimental';
import { RadioButtonGroup } from '@grafana/ui';

import { QUERY_TYPES } from '../constants';
import { EditorMode, CloudMonitoringQuery, QueryType, SLOQuery, MetricQuery } from '../types';

export interface QueryEditorHeaderProps {
  query: CloudMonitoringQuery;
  metricQuery: MetricQuery;
  sloQuery: SLOQuery;
  onChange: (value: CloudMonitoringQuery) => void;
  onRunQuery: () => void;
}

const EDITOR_MODES = [
  { label: 'Builder', value: EditorMode.Visual },
  { label: 'MQL', value: EditorMode.MQL },
];

export const QueryHeader = (props: QueryEditorHeaderProps) => {
  const { query, metricQuery, sloQuery, onChange, onRunQuery } = props;
  const { queryType } = query;
  const { editorMode } = metricQuery;

  return (
    <EditorHeader>
      <InlineSelect
        label="Query type"
        options={QUERY_TYPES}
        value={queryType}
        onChange={({ value }) => {
          onChange({ ...query, sloQuery, queryType: value! });
          onRunQuery();
        }}
      />
      <FlexItem grow={1} />
      {queryType !== QueryType.SLO && (
        <RadioButtonGroup
          size="sm"
          options={EDITOR_MODES}
          value={editorMode || EditorMode.Visual}
          onChange={(value) => {
            onChange({
              ...query,
              metricQuery: {
                ...metricQuery,
                editorMode: value,
              },
            });
          }}
        />
      )}
    </EditorHeader>
  );
};

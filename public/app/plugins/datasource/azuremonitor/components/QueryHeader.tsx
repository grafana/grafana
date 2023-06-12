import React, { useCallback } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorHeader, InlineSelect } from '@grafana/experimental';

import { selectors } from '../e2e/selectors';
import { AzureMonitorQuery, AzureQueryType } from '../types';

interface QueryTypeFieldProps {
  query: AzureMonitorQuery;
  onQueryChange: (newQuery: AzureMonitorQuery) => void;
}

export const QueryHeader = ({ query, onQueryChange }: QueryTypeFieldProps) => {
  const queryTypes: Array<{ value: AzureQueryType; label: string }> = [
    { value: AzureQueryType.AzureMonitor, label: 'Metrics' },
    { value: AzureQueryType.LogAnalytics, label: 'Logs' },
    { value: AzureQueryType.AzureTraces, label: 'Traces' },
    { value: AzureQueryType.AzureResourceGraph, label: 'Azure Resource Graph' },
  ];

  const handleChange = useCallback(
    (change: SelectableValue<AzureQueryType>) => {
      if (change.value && change.value !== query.queryType) {
        onQueryChange({
          refId: query.refId,
          datasource: query.datasource,
          queryType: change.value,
        });
      }
    },
    [onQueryChange, query]
  );

  return (
    <span data-testid={selectors.components.queryEditor.header.select}>
      <EditorHeader>
        <InlineSelect
          label="Service"
          value={query.queryType}
          placeholder="Service..."
          allowCustomValue
          options={queryTypes}
          onChange={handleChange}
        />
      </EditorHeader>
    </span>
  );
};

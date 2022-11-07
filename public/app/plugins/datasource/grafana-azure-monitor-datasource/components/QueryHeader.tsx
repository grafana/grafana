import React, { useCallback } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorHeader, InlineSelect } from '@grafana/experimental';

import { selectors } from '../e2e/selectors';
import { AzureMonitorQuery, AzureQueryType } from '../types';

interface QueryTypeFieldProps {
  query: AzureMonitorQuery;
  onQueryChange: (newQuery: AzureMonitorQuery) => void;
}

export const QueryHeader: React.FC<QueryTypeFieldProps> = ({ query, onQueryChange }) => {
  const queryTypes: Array<{ value: AzureQueryType; label: string }> = [
    { value: AzureQueryType.AzureMonitor, label: 'Metrics' },
    { value: AzureQueryType.LogAnalytics, label: 'Logs' },
    { value: AzureQueryType.AzureResourceGraph, label: 'Azure Resource Graph' },
  ];

  const handleChange = useCallback(
    (change: SelectableValue<AzureQueryType>) => {
      change.value &&
        onQueryChange({
          ...query,
          queryType: change.value,
        });
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

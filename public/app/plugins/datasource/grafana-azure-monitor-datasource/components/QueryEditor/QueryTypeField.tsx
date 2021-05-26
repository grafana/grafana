import React, { useCallback } from 'react';
import { Select } from '@grafana/ui';
import { Field } from '../Field';
import { AzureMonitorQuery, AzureQueryType } from '../../types';
import { SelectableValue } from '@grafana/data';
import { findOption } from '../../utils/common';

const QUERY_TYPES = [
  { value: AzureQueryType.AzureMonitor, label: 'Metrics' },
  { value: AzureQueryType.LogAnalytics, label: 'Logs' },
  { value: AzureQueryType.ApplicationInsights, label: 'Application Insights' },
  { value: AzureQueryType.InsightsAnalytics, label: 'Insights Analytics' },
  { value: AzureQueryType.AzureResourceGraph, label: 'Azure Resource Graph' },
];

interface QueryTypeFieldProps {
  query: AzureMonitorQuery;
  onQueryChange: (newQuery: AzureMonitorQuery) => void;
}

const QueryTypeField: React.FC<QueryTypeFieldProps> = ({ query, onQueryChange }) => {
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
    <Field label="Service">
      <Select
        inputId="azure-monitor-query-type-field"
        value={findOption(QUERY_TYPES, query.queryType)}
        options={QUERY_TYPES}
        onChange={handleChange}
        width={38}
      />
    </Field>
  );
};

export default QueryTypeField;

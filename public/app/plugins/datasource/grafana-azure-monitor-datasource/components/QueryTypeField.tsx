import React, { useCallback } from 'react';
import { Select } from '@grafana/ui';
import { Field } from './Field';
import { AzureMonitorQuery, AzureQueryType } from '../types';
import { SelectableValue } from '@grafana/data';
import { findOption } from './common';

const QUERY_TYPES = [
  { value: AzureQueryType.ApplicationInsights, label: 'Application Insights' },
  { value: AzureQueryType.AzureMonitor, label: 'Metrics' },
  { value: AzureQueryType.LogAnalytics, label: 'Logs' },
  { value: AzureQueryType.InsightsAnalytics, label: 'Insights Analytics' },
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
    [query]
  );

  return (
    <Field label="Service">
      <Select
        value={findOption(QUERY_TYPES, query.queryType)}
        options={QUERY_TYPES}
        onChange={handleChange}
        width={38}
      />
    </Field>
  );
};

export default QueryTypeField;

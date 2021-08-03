import React, { useCallback, useState } from 'react';
import { Select } from '@grafana/ui';
import { Field } from '../Field';
import { AzureMonitorQuery, AzureQueryType } from '../../types';
import { SelectableValue } from '@grafana/data';

interface QueryTypeFieldProps {
  query: AzureMonitorQuery;
  onQueryChange: (newQuery: AzureMonitorQuery) => void;
}

const QueryTypeField: React.FC<QueryTypeFieldProps> = ({ query, onQueryChange }) => {
  // Use useState to capture the initial value on first mount. We're not interested in when it changes
  // We only show App Insights and Insights Analytics if they were initially selected. Otherwise, hide them.
  const [initialQueryType] = useState(query.queryType);
  const showAppInsights =
    initialQueryType === AzureQueryType.ApplicationInsights || initialQueryType === AzureQueryType.InsightsAnalytics;

  const queryTypes = [
    { value: AzureQueryType.AzureMonitor, label: 'Metrics' },
    { value: AzureQueryType.LogAnalytics, label: 'Logs' },
    { value: AzureQueryType.AzureResourceGraph, label: 'Azure Resource Graph' },
  ];

  if (showAppInsights) {
    queryTypes.push(
      { value: AzureQueryType.ApplicationInsights, label: 'Application Insights' },
      { value: AzureQueryType.InsightsAnalytics, label: 'Insights Analytics' }
    );
  }

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
        value={query.queryType}
        options={queryTypes}
        onChange={handleChange}
        width={38}
      />
    </Field>
  );
};

export default QueryTypeField;

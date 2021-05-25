import React, { useCallback, useState } from 'react';
import { Select } from '@grafana/ui';
import { Field } from '../Field';
import { AzureMonitorQuery, AzureQueryType } from '../../types';
import { SelectableValue } from '@grafana/data';
import { findOption } from '../../utils/common';

interface QueryTypeFieldProps {
  query: AzureMonitorQuery;
  onQueryChange: (newQuery: AzureMonitorQuery) => void;
}

function isTruthy<T>(arg: T | undefined | false): arg is T {
  return !!arg;
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
    showAppInsights && { value: AzureQueryType.ApplicationInsights, label: 'Application Insights' },
    showAppInsights && { value: AzureQueryType.InsightsAnalytics, label: 'Insights Analytics' },
  ].filter(isTruthy);

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
        value={findOption(queryTypes, query.queryType)}
        options={queryTypes}
        onChange={handleChange}
        width={38}
      />
    </Field>
  );
};

export default QueryTypeField;

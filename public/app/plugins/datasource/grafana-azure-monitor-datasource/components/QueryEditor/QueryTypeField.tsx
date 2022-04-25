import React, { useCallback, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';

import { AzureMonitorQuery, AzureQueryType, DeprecatedAzureQueryType } from '../../types';
import { Field } from '../Field';
import { gtGrafana9 } from '../deprecated/utils';

interface QueryTypeFieldProps {
  query: AzureMonitorQuery;
  onQueryChange: (newQuery: AzureMonitorQuery) => void;
}

const QueryTypeField: React.FC<QueryTypeFieldProps> = ({ query, onQueryChange }) => {
  // Use useState to capture the initial value on first mount. We're not interested in when it changes
  // We only show App Insights and Insights Analytics if they were initially selected. Otherwise, hide them.
  const [initialQueryType] = useState(query.queryType);

  const queryTypes: Array<{ value: AzureQueryType | DeprecatedAzureQueryType; label: string }> = [
    { value: AzureQueryType.AzureMonitor, label: 'Metrics' },
    { value: AzureQueryType.LogAnalytics, label: 'Logs' },
    { value: AzureQueryType.AzureResourceGraph, label: 'Azure Resource Graph' },
  ];

  if (
    !gtGrafana9() &&
    (initialQueryType === DeprecatedAzureQueryType.ApplicationInsights ||
      initialQueryType === DeprecatedAzureQueryType.InsightsAnalytics)
  ) {
    queryTypes.push(
      { value: DeprecatedAzureQueryType.ApplicationInsights, label: 'Application Insights' },
      { value: DeprecatedAzureQueryType.InsightsAnalytics, label: 'Insights Analytics' }
    );
  }

  const handleChange = useCallback(
    (change: SelectableValue<AzureQueryType | DeprecatedAzureQueryType>) => {
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
        menuShouldPortal
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

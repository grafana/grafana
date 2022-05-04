import React, { useCallback } from 'react';

import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';

import { AzureMonitorQuery, AzureQueryType } from '../../types';
import { Field } from '../Field';

interface QueryTypeFieldProps {
  query: AzureMonitorQuery;
  onQueryChange: (newQuery: AzureMonitorQuery) => void;
}

const QueryTypeField: React.FC<QueryTypeFieldProps> = ({ query, onQueryChange }) => {
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

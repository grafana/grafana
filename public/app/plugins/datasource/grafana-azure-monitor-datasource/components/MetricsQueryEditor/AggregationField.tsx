import React, { useCallback } from 'react';

import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';

import { AzureQueryEditorFieldProps, AzureMonitorOption } from '../../types';
import { addValueToOptions } from '../../utils/common';
import { Field } from '../Field';

import { setAggregation } from './setQueryValue';

interface AggregationFieldProps extends AzureQueryEditorFieldProps {
  aggregationOptions: AzureMonitorOption[];
  isLoading: boolean;
}

const AggregationField: React.FC<AggregationFieldProps> = ({
  query,
  variableOptionGroup,
  onQueryChange,
  aggregationOptions,
  isLoading,
}) => {
  const handleChange = useCallback(
    (change: SelectableValue<string>) => {
      if (!change.value) {
        return;
      }

      const newQuery = setAggregation(query, change.value);
      onQueryChange(newQuery);
    },
    [onQueryChange, query]
  );

  const options = addValueToOptions(aggregationOptions, variableOptionGroup, query.azureMonitor?.aggregation);

  return (
    <Field label="Aggregation">
      <Select
        inputId="azure-monitor-metrics-aggregation-field"
        value={query.azureMonitor?.aggregation || null}
        onChange={handleChange}
        options={options}
        isLoading={isLoading}
      />
    </Field>
  );
};

export default AggregationField;

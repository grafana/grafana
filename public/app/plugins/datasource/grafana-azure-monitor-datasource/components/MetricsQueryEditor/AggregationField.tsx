import React, { useCallback, useMemo } from 'react';
import { Select } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';

import { Field } from '../Field';
import { AzureQueryEditorFieldProps, AzureMonitorOption } from '../../types';
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

  const options = useMemo(() => [...aggregationOptions, variableOptionGroup], [
    aggregationOptions,
    variableOptionGroup,
  ]);

  return (
    <Field label="Aggregation">
      <Select
        menuShouldPortal
        inputId="azure-monitor-metrics-aggregation-field"
        value={query.azureMonitor?.aggregation}
        onChange={handleChange}
        options={options}
        width={38}
        isLoading={isLoading}
      />
    </Field>
  );
};

export default AggregationField;

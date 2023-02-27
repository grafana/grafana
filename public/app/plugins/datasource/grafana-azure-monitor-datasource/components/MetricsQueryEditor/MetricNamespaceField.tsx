import React, { useCallback } from 'react';

import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';

import { AzureQueryEditorFieldProps, AzureMonitorOption } from '../../types';
import { addValueToOptions } from '../../utils/common';
import { Field } from '../Field';

import { setCustomNamespace } from './setQueryValue';

interface MetricNamespaceFieldProps extends AzureQueryEditorFieldProps {
  metricNamespaces: AzureMonitorOption[];
}

const MetricNamespaceField: React.FC<MetricNamespaceFieldProps> = ({
  metricNamespaces,
  query,
  variableOptionGroup,
  onQueryChange,
}) => {
  const handleChange = useCallback(
    (change: SelectableValue<string>) => {
      if (!change.value) {
        return;
      }

      const newQuery = setCustomNamespace(query, change.value);
      onQueryChange(newQuery);
    },
    [onQueryChange, query]
  );

  const value = query.azureMonitor?.customNamespace || query.azureMonitor?.metricNamespace;
  const options = addValueToOptions(metricNamespaces, variableOptionGroup, value);

  return (
    <Field label="Metric namespace">
      <Select
        inputId="azure-monitor-metrics-metric-namespace-field"
        value={value || null}
        onChange={handleChange}
        options={options}
        allowCustomValue
      />
    </Field>
  );
};

export default MetricNamespaceField;

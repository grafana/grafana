import React, { useCallback, useMemo } from 'react';
import { Select } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';

import { Field } from '../Field';
import { AzureQueryEditorFieldProps, AzureMonitorOption } from '../../types';
import { setMetricNamespace } from './setQueryValue';

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

      const newQuery = setMetricNamespace(query, change.value);
      onQueryChange(newQuery);
    },
    [onQueryChange, query]
  );

  const options = useMemo(() => [...metricNamespaces, variableOptionGroup], [metricNamespaces, variableOptionGroup]);
  const optionValues = metricNamespaces.map((m) => m.value).concat(variableOptionGroup.options.map((p) => p.value));
  const value = query.azureMonitor?.metricNamespace;
  if (value && !optionValues.includes(value)) {
    options.push({ label: value, value });
  }

  return (
    <Field label="Metric namespace">
      <Select
        menuShouldPortal
        inputId="azure-monitor-metrics-metric-namespace-field"
        value={query.azureMonitor?.metricNamespace}
        onChange={handleChange}
        options={options}
        width={38}
      />
    </Field>
  );
};

export default MetricNamespaceField;

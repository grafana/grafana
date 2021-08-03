import React, { useCallback, useMemo } from 'react';
import { Select } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';

import { Field } from '../Field';
import { AzureQueryEditorFieldProps, AzureMonitorOption } from '../../types';
import { setMetricName } from './setQueryValue';

interface MetricNameProps extends AzureQueryEditorFieldProps {
  metricNames: AzureMonitorOption[];
}

const MetricNameField: React.FC<MetricNameProps> = ({ metricNames, query, variableOptionGroup, onQueryChange }) => {
  const handleChange = useCallback(
    (change: SelectableValue<string>) => {
      if (!change.value) {
        return;
      }

      const newQuery = setMetricName(query, change.value);
      onQueryChange(newQuery);
    },
    [onQueryChange, query]
  );

  const options = useMemo(() => [...metricNames, variableOptionGroup], [metricNames, variableOptionGroup]);

  return (
    <Field label="Metric">
      <Select
        inputId="azure-monitor-metrics-metric-field"
        value={query.azureMonitor?.metricName ?? null}
        onChange={handleChange}
        options={options}
        width={38}
      />
    </Field>
  );
};

export default MetricNameField;

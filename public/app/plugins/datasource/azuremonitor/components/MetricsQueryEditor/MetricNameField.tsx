import React, { useCallback } from 'react';

import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';

import { selectors } from '../../e2e/selectors';
import { AzureQueryEditorFieldProps, AzureMonitorOption } from '../../types';
import { addValueToOptions } from '../../utils/common';
import { Field } from '../Field';

import { setMetricName } from './setQueryValue';

interface MetricNameProps extends AzureQueryEditorFieldProps {
  metricNames: AzureMonitorOption[];
}

const MetricNameField = ({ metricNames, query, variableOptionGroup, onQueryChange }: MetricNameProps) => {
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

  const options = addValueToOptions(metricNames, variableOptionGroup, query.azureMonitor?.metricName);

  return (
    <Field label="Metric" data-testid={selectors.components.queryEditor.metricsQueryEditor.metricName.input}>
      <Select
        inputId="azure-monitor-metrics-metric-field"
        value={query.azureMonitor?.metricName ?? null}
        onChange={handleChange}
        options={options}
        allowCustomValue
      />
    </Field>
  );
};

export default MetricNameField;

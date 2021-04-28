import React, { useCallback, useMemo } from 'react';
import { Select } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';

import { Field } from '../Field';
import { findOption } from '../../utils/common';
import { AzureQueryEditorFieldProps } from '../../types';
import { useMetricDropdownOptions } from '../metrics';

const ERROR_SOURCE = 'metrics-metricname';
const MetricName: React.FC<AzureQueryEditorFieldProps> = ({
  query,
  datasource,
  subscriptionId,
  variableOptionGroup,
  onQueryChange,
  setError,
}) => {
  const { resourceGroup, metricDefinition, resourceName, metricNamespace } = query.azureMonitor;
  const [metricNames, isLoading] = useMetricDropdownOptions(
    datasource.getMetricNames.bind(datasource),
    [subscriptionId, resourceGroup, metricDefinition, resourceName, metricNamespace],
    setError,
    ERROR_SOURCE
  );

  const handleChange = useCallback(
    (change: SelectableValue<string>) => {
      if (!change.value) {
        return;
      }

      onQueryChange({
        ...query,
        azureMonitor: {
          ...query.azureMonitor,
          metricName: change.value,
        },
      });
    },
    [onQueryChange, query]
  );

  const options = useMemo(() => [...metricNames, variableOptionGroup], [metricNames, variableOptionGroup]);

  return (
    <Field label="Metric">
      <Select
        isLoading={isLoading}
        inputId="azure-monitor-metrics-metric-field"
        value={findOption(metricNames, query.azureMonitor.metricName)}
        onChange={handleChange}
        options={options}
        width={38}
      />
    </Field>
  );
};

export default MetricName;

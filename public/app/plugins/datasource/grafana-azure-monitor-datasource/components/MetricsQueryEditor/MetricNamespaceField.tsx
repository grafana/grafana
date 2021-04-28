import React, { useCallback, useMemo } from 'react';
import { Select } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';

import { Field } from '../Field';
import { findOption } from '../../utils/common';
import { AzureQueryEditorFieldProps } from '../../types';
import { useMetricDropdownOptions } from '../metrics';

const ERROR_SOURCE = 'metrics-metricnamespace';

const MetricNamespaceField: React.FC<AzureQueryEditorFieldProps> = ({
  query,
  datasource,
  subscriptionId,
  variableOptionGroup,
  onQueryChange,
  setError,
}) => {
  const { resourceGroup, metricDefinition, resourceName } = query.azureMonitor;

  const setQueryAfterFetch = (results: Array<{ text: string; value: string }>) => {
    if (results.length === 1) {
      onQueryChange({
        ...query,
        azureMonitor: {
          ...query.azureMonitor,
          metricNamespace: results[0].value,
        },
      });
    }
    return results;
  };

  const [metricNamespaces, isLoading] = useMetricDropdownOptions(
    datasource.getMetricNamespaces.bind(datasource),
    [subscriptionId, resourceGroup, metricDefinition, resourceName],
    setError,
    ERROR_SOURCE,
    setQueryAfterFetch
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
          metricNamespace: change.value,

          metricName: undefined,
          dimensionFilters: [],
        },
      });
    },
    [onQueryChange, query]
  );

  const options = useMemo(() => [...metricNamespaces, variableOptionGroup], [metricNamespaces, variableOptionGroup]);

  return (
    <Field label="Metric namespace">
      <Select
        inputId="azure-monitor-metrics-metric-namespace-field"
        value={findOption(metricNamespaces, query.azureMonitor.metricNamespace)}
        onChange={handleChange}
        options={options}
        width={38}
        isLoading={isLoading}
      />
    </Field>
  );
};

export default MetricNamespaceField;

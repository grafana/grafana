import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Select } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';

import { Field } from '../Field';
import { findOption, toOption } from '../common';
import { AzureQueryEditorFieldProps, AzureMonitorOption } from '../../types';

const MetricNamespaceField: React.FC<AzureQueryEditorFieldProps> = ({
  query,
  datasource,
  subscriptionId,
  variableOptionGroup,
  onQueryChange,
}) => {
  const [metricNamespaces, setMetricNamespaces] = useState<AzureMonitorOption[]>([]);

  useEffect(() => {
    if (!(subscriptionId && query.azureMonitor.resourceGroup, query.azureMonitor.metricDefinition)) {
      metricNamespaces.length > 0 && setMetricNamespaces([]);
      return;
    }

    datasource
      .getMetricNamespaces(
        subscriptionId,
        query.azureMonitor.resourceGroup,
        query.azureMonitor.metricDefinition,
        query.azureMonitor.resourceName
      )
      .then((results) => setMetricNamespaces(results.map(toOption)))
      .catch((err) => {
        // TODO: handle error
        console.error(err);
      });
  }, [
    subscriptionId,
    query.azureMonitor.resourceGroup,
    query.azureMonitor.metricDefinition,
    query.azureMonitor.resourceName,
  ]);

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

          metricName: 'select',
          dimensionFilters: [],
        },
      });
    },
    [query]
  );

  const options = useMemo(() => [...metricNamespaces, variableOptionGroup], [metricNamespaces, variableOptionGroup]);

  return (
    <Field label="Metric Namespace">
      <Select
        inputId="azure-monitor-metrics-metric-namespace-field"
        value={findOption(metricNamespaces, query.azureMonitor.metricNamespace)}
        onChange={handleChange}
        options={options}
        width={38}
      />
    </Field>
  );
};

export default MetricNamespaceField;

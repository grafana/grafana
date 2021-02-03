import React, { useEffect, useState } from 'react';

import { InlineField, Select } from '@grafana/ui';
import { findOption, MetricsQueryEditorFieldProps, Options, toOption } from '../common';

const MetricNamespaceField: React.FC<MetricsQueryEditorFieldProps> = ({
  query,
  datasource,
  subscriptionId,
  onChange,
}) => {
  const [options, setOptions] = useState<Options>([]);

  useEffect(() => {
    if (!(subscriptionId && query.azureMonitor.resourceGroup, query.azureMonitor.metricDefinition)) {
      return;
    }

    datasource
      .getMetricNamespaces(
        subscriptionId,
        query.azureMonitor.resourceGroup,
        query.azureMonitor.metricDefinition,
        query.azureMonitor.resourceName
      )
      .then((results) => setOptions(results.map(toOption)))
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

  return (
    <InlineField label="Metric Namespace" labelWidth={16}>
      <Select
        value={findOption(options, query.azureMonitor.metricNamespace)}
        onChange={(v) => onChange('metricNamespace', v)}
        options={options}
      />
    </InlineField>
  );
};

export default MetricNamespaceField;

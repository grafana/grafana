import React, { useEffect, useState } from 'react';
import { Select } from '@grafana/ui';

import { Field } from '../Field';
import { findOption, MetricsQueryEditorFieldProps, Option, toOption } from '../common';

const MetricNamespaceField: React.FC<MetricsQueryEditorFieldProps> = ({
  query,
  datasource,
  subscriptionId,
  onChange,
}) => {
  const [options, setOptions] = useState<Option[]>([]);

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
    <Field label="Metric Namespace" labelWidth={16}>
      <Select
        value={findOption(options, query.azureMonitor.metricNamespace)}
        onChange={(v) => v.value && onChange('metricNamespace', v.value)}
        options={options}
      />
    </Field>
  );
};

export default MetricNamespaceField;

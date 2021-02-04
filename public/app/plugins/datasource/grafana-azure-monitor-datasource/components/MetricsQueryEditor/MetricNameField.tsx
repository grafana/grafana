import React, { useEffect, useState } from 'react';
import { Select } from '@grafana/ui';

import { Field } from '../Field';
import { findOption, MetricsQueryEditorFieldProps, Option, toOption } from '../common';

const MetricName: React.FC<MetricsQueryEditorFieldProps> = ({ query, datasource, subscriptionId, onChange }) => {
  const [options, setOptions] = useState<Option[]>([]);

  useEffect(() => {
    if (
      !(
        subscriptionId &&
        query.azureMonitor.resourceGroup &&
        query.azureMonitor.metricDefinition &&
        query.azureMonitor.resourceName &&
        query.azureMonitor.metricNamespace
      )
    ) {
      return;
    }

    datasource
      .getMetricNames(
        subscriptionId,
        query.azureMonitor.resourceGroup,
        query.azureMonitor.metricDefinition,
        query.azureMonitor.resourceName,
        query.azureMonitor.metricNamespace
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
    query.azureMonitor.metricNamespace,
  ]);

  return (
    <Field label="Metric" labelWidth={16}>
      <Select
        value={findOption(options, query.azureMonitor.metricName)}
        onChange={(v) => v.value && onChange('metricName', v.value)}
        options={options}
      />
    </Field>
  );
};

export default MetricName;

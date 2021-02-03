import React, { useEffect, useState } from 'react';

import { InlineField, Select } from '@grafana/ui';
import { findOption, MetricsQueryEditorFieldProps, Options, toOption } from '../common';

const MetricName: React.FC<MetricsQueryEditorFieldProps> = ({ query, datasource, subscriptionId, onChange }) => {
  const [options, setOptions] = useState<Options>([]);
  const azureMonitorIsConfigured = datasource.azureMonitorDatasource.isConfigured();

  useEffect(() => {
    if (
      !(
        azureMonitorIsConfigured &&
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
        datasource.replace(subscriptionId),
        datasource.replace(query.azureMonitor.resourceGroup),
        datasource.replace(query.azureMonitor.metricDefinition),
        datasource.replace(query.azureMonitor.resourceName),
        datasource.replace(query.azureMonitor.metricNamespace)
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
    <InlineField label="Metric" labelWidth={16}>
      <Select
        value={findOption(options, query.azureMonitor.metricName)}
        onChange={(v) => onChange('metricName', v)}
        options={options}
      />
    </InlineField>
  );
};

export default MetricName;

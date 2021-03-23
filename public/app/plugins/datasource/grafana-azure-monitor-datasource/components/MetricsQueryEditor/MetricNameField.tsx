import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Select } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';

import { Field } from '../Field';
import { findOption, toOption } from '../common';
import { AzureQueryEditorFieldProps, AzureMonitorOption } from '../../types';

const MetricName: React.FC<AzureQueryEditorFieldProps> = ({
  query,
  datasource,
  subscriptionId,
  variableOptionGroup,
  onQueryChange,
}) => {
  const [metricNames, setMetricNames] = useState<AzureMonitorOption[]>([]);

  useEffect(() => {
    const { resourceGroup, metricDefinition, resourceName, metricNamespace } = query.azureMonitor;

    if (!(subscriptionId && resourceGroup && metricDefinition && resourceName && metricNamespace)) {
      metricNames.length > 0 && setMetricNames([]);
      return;
    }

    datasource
      .getMetricNames(subscriptionId, resourceGroup, metricDefinition, resourceName, metricNamespace)
      .then((results) => {
        setMetricNames(results.map(toOption));
      })
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
    [query]
  );

  const options = useMemo(() => [...metricNames, variableOptionGroup], [metricNames, variableOptionGroup]);

  return (
    <Field label="Metric">
      <Select
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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Select } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';

import { Field } from '../Field';
import { findOption, toOption } from '../../utils/common';
import { AzureQueryEditorFieldProps, AzureMonitorOption } from '../../types';

const ERROR_SOURCE = 'metrics-metricname';
const MetricName: React.FC<AzureQueryEditorFieldProps> = ({
  query,
  datasource,
  subscriptionId,
  variableOptionGroup,
  onQueryChange,
  setError,
}) => {
  const [metricNames, setMetricNames] = useState<AzureMonitorOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const { resourceGroup, metricDefinition, resourceName, metricNamespace } = query.azureMonitor ?? {};
    if (!(subscriptionId && resourceGroup && metricDefinition && resourceName && metricNamespace)) {
      metricNames.length > 0 && setMetricNames([]);
      return;
    }
    setIsLoading(true);

    datasource
      .getMetricNames(subscriptionId, resourceGroup, metricDefinition, resourceName, metricNamespace)
      .then((results) => {
        setMetricNames(results.map(toOption));
        setIsLoading(false);
      })
      .catch((err) => {
        setError(ERROR_SOURCE, err);
        setIsLoading(false);
      });
  }, [datasource, metricNames.length, query.azureMonitor, setError, subscriptionId]);

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
        inputId="azure-monitor-metrics-metric-field"
        value={findOption(metricNames, query.azureMonitor?.metricName)}
        onChange={handleChange}
        options={options}
        width={38}
        isLoading={isLoading}
      />
    </Field>
  );
};

export default MetricName;

import React, { useCallback, useEffect, useState } from 'react';
import { Select } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';

import { Field } from '../Field';
import { findOption, toOption } from '../common';
import { AzureQueryEditorFieldProps, Option } from '../../types';

const MetricName: React.FC<AzureQueryEditorFieldProps> = ({ query, datasource, subscriptionId, onQueryChange }) => {
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
      options.length > 0 && setOptions([]);
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

  return (
    <Field label="Metric">
      <Select
        value={findOption(options, query.azureMonitor.metricName)}
        onChange={handleChange}
        options={options}
        width={38}
      />
    </Field>
  );
};

export default MetricName;

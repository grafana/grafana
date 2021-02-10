import React, { useCallback, useEffect, useState } from 'react';
import { Select } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';

import { Field } from '../Field';
import { findOption, toOption } from '../common';
import { AzureQueryEditorFieldProps, Option } from '../../types';

const MetricNamespaceField: React.FC<AzureQueryEditorFieldProps> = ({
  query,
  datasource,
  subscriptionId,
  onQueryChange,
}) => {
  const [options, setOptions] = useState<Option[]>([]);

  useEffect(() => {
    if (!(subscriptionId && query.azureMonitor.resourceGroup, query.azureMonitor.metricDefinition)) {
      options.length > 0 && setOptions([]);
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

  return (
    <Field label="Metric Namespace">
      <Select
        value={findOption(options, query.azureMonitor.metricNamespace)}
        onChange={handleChange}
        options={options}
        width={38}
      />
    </Field>
  );
};

export default MetricNamespaceField;

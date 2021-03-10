import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Select } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';

import { Field } from '../Field';
import { findOption, toOption } from '../common';
import { AzureQueryEditorFieldProps, AzureMonitorOption } from '../../types';

const NamespaceField: React.FC<AzureQueryEditorFieldProps> = ({
  query,
  datasource,
  subscriptionId,
  variableOptionGroup,
  onQueryChange,
}) => {
  const [namespaces, setNamespaces] = useState<AzureMonitorOption[]>([]);

  useEffect(() => {
    if (!(subscriptionId && query.azureMonitor.resourceGroup)) {
      namespaces.length && setNamespaces([]);
      return;
    }

    datasource
      .getMetricDefinitions(subscriptionId, query.azureMonitor.resourceGroup)
      .then((results) => setNamespaces(results.map(toOption)))
      .catch((err) => {
        // TODO: handle error
        console.error(err);
      });
  }, [subscriptionId, query.azureMonitor.resourceGroup]);

  const handleChange = useCallback(
    (change: SelectableValue<string>) => {
      if (!change.value) {
        return;
      }

      onQueryChange({
        ...query,
        azureMonitor: {
          ...query.azureMonitor,
          metricDefinition: change.value,
          resourceName: 'select',
          metricNamespace: 'select',
          metricName: 'select',
          aggregation: '',
          timeGrain: '',
          dimensionFilters: [],
        },
      });
    },
    [query]
  );

  const options = useMemo(() => [...namespaces, variableOptionGroup], [namespaces, variableOptionGroup]);

  return (
    <Field label="Namespace">
      {/* It's expected that the label reads Namespace but the property is metricDefinition */}
      <Select
        inputId="azure-monitor-metrics-namespace-field"
        value={findOption(namespaces, query.azureMonitor.metricDefinition)}
        onChange={handleChange}
        options={options}
        width={38}
      />
    </Field>
  );
};

export default NamespaceField;

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Select } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';

import { Field } from '../Field';
import { findOption, toOption } from '../common';
import { AzureQueryEditorFieldProps, AzureMonitorOption } from '../../types';

const ResourceGroupsField: React.FC<AzureQueryEditorFieldProps> = ({
  query,
  datasource,
  subscriptionId,
  variableOptionGroup,
  onQueryChange,
}) => {
  const [resourceGroups, setResourceGroups] = useState<AzureMonitorOption[]>([]);

  useEffect(() => {
    if (!subscriptionId) {
      resourceGroups.length > 0 && setResourceGroups([]);
      return;
    }

    datasource
      .getResourceGroups(subscriptionId)
      .then((results) => setResourceGroups(results.map(toOption)))
      .catch((err) => {
        // TODO: handle error
        console.error(err);
      });
  }, [subscriptionId]);

  const handleChange = useCallback(
    (change: SelectableValue<string>) => {
      if (!change.value) {
        return;
      }

      onQueryChange({
        ...query,
        azureMonitor: {
          ...query.azureMonitor,
          resourceGroup: change.value,
          metricDefinition: undefined,
          resourceName: undefined,
          metricNamespace: undefined,
          metricName: undefined,
          aggregation: '',
          timeGrain: '',
          dimensionFilters: [],
        },
      });
    },
    [query]
  );

  const options = useMemo(() => [...resourceGroups, variableOptionGroup], [resourceGroups, variableOptionGroup]);

  return (
    <Field label="Resource Group">
      <Select
        inputId="azure-monitor-metrics-resource-group-field"
        value={findOption(resourceGroups, query.azureMonitor.resourceGroup)}
        onChange={handleChange}
        options={options}
        width={38}
      />
    </Field>
  );
};

export default ResourceGroupsField;

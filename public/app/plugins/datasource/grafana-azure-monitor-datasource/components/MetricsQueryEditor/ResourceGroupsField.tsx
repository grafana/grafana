import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Select } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';

import { Field } from '../Field';
import { findOption, toOption } from '../../utils/common';
import { AzureQueryEditorFieldProps, AzureMonitorOption } from '../../types';

const ERROR_SOURCE = 'metrics-resourcegroups';
const ResourceGroupsField: React.FC<AzureQueryEditorFieldProps> = ({
  query,
  datasource,
  subscriptionId,
  variableOptionGroup,
  onQueryChange,
  setError,
}) => {
  const [resourceGroups, setResourceGroups] = useState<AzureMonitorOption[]>([]);

  useEffect(() => {
    if (!subscriptionId) {
      resourceGroups.length > 0 && setResourceGroups([]);
      return;
    }

    datasource
      .getResourceGroups(subscriptionId)
      .then((results) => {
        setResourceGroups(results.map(toOption));
        setError(ERROR_SOURCE, undefined);
      })
      .catch((err) => setError(ERROR_SOURCE, err));
  }, [datasource, resourceGroups.length, setError, subscriptionId]);

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
          aggregation: undefined,
          timeGrain: '',
          dimensionFilters: [],
        },
      });
    },
    [onQueryChange, query]
  );

  const options = useMemo(() => [...resourceGroups, variableOptionGroup], [resourceGroups, variableOptionGroup]);

  return (
    <Field label="Resource group">
      <Select
        inputId="azure-monitor-metrics-resource-group-field"
        value={findOption(resourceGroups, query.azureMonitor?.resourceGroup)}
        onChange={handleChange}
        options={options}
        width={38}
      />
    </Field>
  );
};

export default ResourceGroupsField;

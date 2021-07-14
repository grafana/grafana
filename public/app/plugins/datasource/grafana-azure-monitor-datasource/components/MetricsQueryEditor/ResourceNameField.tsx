import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Select } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';

import { Field } from '../Field';
import { findOption, toOption } from '../../utils/common';
import { AzureQueryEditorFieldProps, AzureMonitorOption } from '../../types';

const ERROR_SOURCE = 'metrics-resource';
const ResourceNameField: React.FC<AzureQueryEditorFieldProps> = ({
  query,
  datasource,
  subscriptionId,
  variableOptionGroup,
  onQueryChange,
  setError,
}) => {
  const [resourceNames, setResourceNames] = useState<AzureMonitorOption[]>([]);

  useEffect(() => {
    const { resourceGroup, metricDefinition } = query.azureMonitor ?? {};

    if (!(subscriptionId && resourceGroup && metricDefinition)) {
      resourceNames.length > 0 && setResourceNames([]);
      return;
    }

    datasource
      .getResourceNames(subscriptionId, resourceGroup, metricDefinition)
      .then((results) => setResourceNames(results.map(toOption)))
      .catch((err) => setError(ERROR_SOURCE, err));
  }, [datasource, query.azureMonitor, resourceNames.length, setError, subscriptionId]);

  const handleChange = useCallback(
    (change: SelectableValue<string>) => {
      if (!change.value) {
        return;
      }

      onQueryChange({
        ...query,
        azureMonitor: {
          ...query.azureMonitor,
          resourceName: change.value,

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

  const options = useMemo(() => [...resourceNames, variableOptionGroup], [resourceNames, variableOptionGroup]);

  const selectedResourceNameValue = findOption(resourceNames, query.azureMonitor?.resourceName);
  return (
    <Field label="Resource name">
      <Select
        inputId="azure-monitor-metrics-resource-name-field"
        value={selectedResourceNameValue}
        onChange={handleChange}
        options={options}
        width={38}
      />
    </Field>
  );
};

export default ResourceNameField;

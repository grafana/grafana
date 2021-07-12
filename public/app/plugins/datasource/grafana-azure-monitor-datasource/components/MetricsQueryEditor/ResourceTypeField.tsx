import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Select } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';

import { Field } from '../Field';
import { findOption, toOption } from '../../utils/common';
import { AzureQueryEditorFieldProps, AzureMonitorOption } from '../../types';
import { setResourceType } from './setQueryValue';

const ERROR_SOURCE = 'resource-type';
const NamespaceField: React.FC<AzureQueryEditorFieldProps> = ({
  query,
  datasource,
  subscriptionId,
  variableOptionGroup,
  onQueryChange,
  setError,
}) => {
  const [namespaces, setNamespaces] = useState<AzureMonitorOption[]>([]);

  useEffect(() => {
    const { resourceGroup } = query.azureMonitor ?? {};

    if (!(subscriptionId && resourceGroup)) {
      namespaces.length && setNamespaces([]);
      return;
    }

    datasource
      .getMetricDefinitions(subscriptionId, resourceGroup)
      .then((results) => setNamespaces(results.map(toOption)))
      .catch((err) => setError(ERROR_SOURCE, err));
  }, [datasource, namespaces.length, query.azureMonitor, setError, subscriptionId]);

  const handleChange = useCallback(
    (change: SelectableValue<string>) => {
      if (!change.value) {
        return;
      }

      const newQuery = setResourceType(query, change.value);
      onQueryChange(newQuery);
    },
    [onQueryChange, query]
  );

  const options = useMemo(() => [...namespaces, variableOptionGroup], [namespaces, variableOptionGroup]);

  return (
    <Field label="Resource type">
      {/* It's expected that the label reads Resource type but the property is metricDefinition */}
      <Select
        inputId="azure-monitor-metrics-resource-type-field"
        value={findOption(namespaces, query.azureMonitor?.metricDefinition)}
        onChange={handleChange}
        options={options}
        width={38}
      />
    </Field>
  );
};

export default NamespaceField;

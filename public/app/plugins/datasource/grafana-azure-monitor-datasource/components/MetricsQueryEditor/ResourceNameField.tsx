import React, { useCallback, useMemo } from 'react';
import { Select } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';

import { Field } from '../Field';
import { AzureQueryEditorFieldProps, AzureMonitorOption } from '../../types';
import { setResourceName } from './setQueryValue';

interface ResourceNameFieldProps extends AzureQueryEditorFieldProps {
  resourceNames: AzureMonitorOption[];
}

const ResourceNameField: React.FC<ResourceNameFieldProps> = ({
  resourceNames,
  query,
  variableOptionGroup,
  onQueryChange,
}) => {
  const handleChange = useCallback(
    (change: SelectableValue<string>) => {
      const newQuery = setResourceName(query, change.value);
      onQueryChange(newQuery);
    },
    [onQueryChange, query]
  );

  const options = useMemo(() => [...resourceNames, variableOptionGroup], [resourceNames, variableOptionGroup]);
  const value = query.azureMonitor?.resourceName ?? null;

  return (
    <Field label="Resource name">
      <Select
        inputId="azure-monitor-metrics-resource-name-field"
        value={value}
        onChange={handleChange}
        options={options}
        width={38}
      />
    </Field>
  );
};

export default ResourceNameField;

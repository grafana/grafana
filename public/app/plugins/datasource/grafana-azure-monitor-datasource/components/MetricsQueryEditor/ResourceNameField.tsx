import React, { useCallback, useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';

import { AzureQueryEditorFieldProps, AzureMonitorOption } from '../../types';
import { Field } from '../Field';

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
        menuShouldPortal
        inputId="azure-monitor-metrics-resource-name-field"
        value={value}
        onChange={handleChange}
        options={options}
        width={38}
        allowCustomValue
      />
    </Field>
  );
};

export default ResourceNameField;

import React, { useCallback, useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';

import { AzureQueryEditorFieldProps, AzureMonitorOption } from '../../types';
import { Field } from '../Field';

import { setResourceGroup } from './setQueryValue';

interface ResourceGroupsFieldProps extends AzureQueryEditorFieldProps {
  resourceGroups: AzureMonitorOption[];
}

const ResourceGroupsField: React.FC<ResourceGroupsFieldProps> = ({
  query,
  resourceGroups,
  variableOptionGroup,
  onQueryChange,
  setError,
}) => {
  const handleChange = useCallback(
    (change: SelectableValue<string>) => {
      const newQuery = setResourceGroup(query, change.value);
      onQueryChange(newQuery);
    },
    [onQueryChange, query]
  );

  const options = useMemo(() => [...resourceGroups, variableOptionGroup], [resourceGroups, variableOptionGroup]);

  return (
    <Field label="Resource group">
      <Select
        menuShouldPortal
        inputId="azure-monitor-metrics-resource-group-field"
        value={query.azureMonitor?.resourceGroup}
        onChange={handleChange}
        options={options}
        width={38}
        allowCustomValue
      />
    </Field>
  );
};

export default ResourceGroupsField;

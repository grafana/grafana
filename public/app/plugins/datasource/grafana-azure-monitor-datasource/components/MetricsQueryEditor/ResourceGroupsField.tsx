import React, { useCallback, useMemo } from 'react';
import { Select } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';

import { Field } from '../Field';
import { AzureQueryEditorFieldProps, AzureMonitorOption } from '../../types';
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
        inputId="azure-monitor-metrics-resource-group-field"
        value={query.azureMonitor?.resourceGroup}
        onChange={handleChange}
        options={options}
        width={38}
      />
    </Field>
  );
};

export default ResourceGroupsField;

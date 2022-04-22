import React, { useCallback, useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';

import { AzureQueryEditorFieldProps, AzureMonitorOption } from '../../types';
import { Field } from '../Field';

import { setResourceType } from './setQueryValue';

interface NamespaceFieldProps extends AzureQueryEditorFieldProps {
  resourceTypes: AzureMonitorOption[];
}

const NamespaceField: React.FC<NamespaceFieldProps> = ({
  resourceTypes,
  query,
  variableOptionGroup,
  onQueryChange,
}) => {
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

  const options = useMemo(() => [...resourceTypes, variableOptionGroup], [resourceTypes, variableOptionGroup]);

  return (
    <Field label="Resource type">
      {/* It's expected that the label reads Resource type but the property is metricDefinition */}
      <Select
        menuShouldPortal
        inputId="azure-monitor-metrics-resource-type-field"
        value={query.azureMonitor?.metricDefinition}
        onChange={handleChange}
        options={options}
        width={38}
        allowCustomValue
      />
    </Field>
  );
};

export default NamespaceField;

import React, { useCallback, useMemo } from 'react';
import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';
import { AzureMonitorOption, AzureQueryEditorFieldProps, AzureResultFormat } from '../../types';
import { Field } from '../Field';
import { setFormatAs } from './setQueryValue';

const FORMAT_OPTIONS: Array<AzureMonitorOption<AzureResultFormat>> = [
  { label: 'Time series', value: 'time_series' },
  { label: 'Table', value: 'table' },
];

const FormatAsField: React.FC<AzureQueryEditorFieldProps> = ({ query, variableOptionGroup, onQueryChange }) => {
  const options = useMemo(() => [...FORMAT_OPTIONS, variableOptionGroup], [variableOptionGroup]);

  const handleChange = useCallback(
    (change: SelectableValue<AzureResultFormat>) => {
      const { value } = change;
      if (!value) {
        return;
      }

      const newQuery = setFormatAs(query, value);
      onQueryChange(newQuery);
    },
    [onQueryChange, query]
  );

  return (
    <Field label="Format as">
      <Select
        menuShouldPortal
        inputId="azure-monitor-logs-workspaces-field"
        value={query.azureLogAnalytics?.resultFormat}
        onChange={handleChange}
        options={options}
        width={38}
      />
    </Field>
  );
};

export default FormatAsField;

import React, { useCallback, useMemo } from 'react';
import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';
import { AzureMonitorOption, AzureQueryEditorFieldProps, AzureResultFormat } from '../../types';
import { findOption } from '../../utils/common';
import { Field } from '../Field';

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

      onQueryChange({
        ...query,
        azureLogAnalytics: {
          ...query.azureLogAnalytics,
          resultFormat: value,
        },
      });
    },
    [onQueryChange, query]
  );

  return (
    <Field label="Format as">
      <Select
        inputId="azure-monitor-logs-workspaces-field"
        value={findOption(FORMAT_OPTIONS, query.azureLogAnalytics?.resultFormat)}
        onChange={handleChange}
        options={options}
        width={38}
      />
    </Field>
  );
};

export default FormatAsField;

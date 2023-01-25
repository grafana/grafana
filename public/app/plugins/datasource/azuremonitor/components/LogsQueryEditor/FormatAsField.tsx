import React, { useCallback, useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';

import { selectors } from '../../e2e/selectors';
import { AzureQueryEditorFieldProps } from '../../types';
import { Field } from '../Field';

import { setFormatAs } from './setQueryValue';

const FORMAT_OPTIONS: Array<SelectableValue<string>> = [
  { label: 'Time series', value: 'time_series' },
  { label: 'Table', value: 'table' },
];

const FormatAsField: React.FC<AzureQueryEditorFieldProps> = ({ query, variableOptionGroup, onQueryChange }) => {
  const options = useMemo(() => [...FORMAT_OPTIONS, variableOptionGroup], [variableOptionGroup]);

  const handleChange = useCallback(
    (change: SelectableValue<string>) => {
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
    <Field label="Format as" data-testid={selectors.components.queryEditor.logsQueryEditor.formatSelection.input}>
      <Select
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

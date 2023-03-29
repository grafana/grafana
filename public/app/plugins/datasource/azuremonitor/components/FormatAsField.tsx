import React, { useCallback, useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';

import { selectors } from '../e2e/selectors';
import { FormatAsFieldProps, ResultFormat } from '../types';

import { Field } from './Field';
import { setFormatAs } from './LogsQueryEditor/setQueryValue';

const FormatAsField = ({
  query,
  variableOptionGroup,
  onQueryChange,
  inputId,
  options: formatOptions,
  defaultValue,
}: FormatAsFieldProps) => {
  const options = useMemo(() => [...formatOptions, variableOptionGroup], [variableOptionGroup, formatOptions]);

  const handleChange = useCallback(
    (change: SelectableValue<ResultFormat>) => {
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
        inputId={`${inputId}-format-as-field`}
        value={query.azureLogAnalytics?.resultFormat ?? defaultValue}
        onChange={handleChange}
        options={options}
        width={38}
      />
    </Field>
  );
};

export default FormatAsField;

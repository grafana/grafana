import React, { useCallback, useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { MultiSelect } from '@grafana/ui';

import { AzureQueryEditorFieldProps, AzureMonitorOption } from '../../types';
import { findOptions } from '../../utils/common';
import { Field } from '../Field';

import { Tables } from './consts';
import { setTraceTypes } from './setQueryValue';

const TraceTypeField = ({ query, variableOptionGroup, onQueryChange }: AzureQueryEditorFieldProps) => {
  const tables: AzureMonitorOption[] = Object.entries(Tables).map(([key, value]) => ({ label: value, value: key }));
  const handleChange = useCallback(
    (change: Array<SelectableValue<string>>) => {
      const newQuery = setTraceTypes(
        query,
        change.map((type) => type.value ?? '')
      );
      onQueryChange(newQuery);
    },
    [onQueryChange, query]
  );

  const options = useMemo(() => [...tables, variableOptionGroup], [tables, variableOptionGroup]);

  return (
    <Field label="Trace Type">
      <MultiSelect
        inputId="azure-monitor-traces-type-field"
        value={findOptions([...tables, ...variableOptionGroup.options], query.azureTraces?.traceTypes ?? [])}
        onChange={handleChange}
        options={options}
        allowCustomValue
        isClearable
      />
    </Field>
  );
};

export default TraceTypeField;

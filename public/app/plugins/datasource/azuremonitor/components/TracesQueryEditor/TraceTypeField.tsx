import { useCallback, useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { MultiSelect } from '@grafana/ui';

import { selectors } from '../../e2e/selectors';
import { AzureMonitorOption, AzureQueryEditorFieldProps } from '../../types/types';
import { findOptions } from '../../utils/common';
import { Field } from '../shared/Field';

import { Tables } from './consts';
import { setTraceTypes } from './setQueryValue';

const TraceTypeField = ({ query, variableOptionGroup, onQueryChange }: AzureQueryEditorFieldProps) => {
  const tables: AzureMonitorOption[] = Object.entries(Tables).map(([key, value]) => ({
    label: value.label,
    description: value.description,
    value: key,
  }));
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

  // Select all trace event ypes by default
  const getDefaultOptions = () => {
    const allEventTypes = tables.map((t) => t.value);
    const defaultQuery = setTraceTypes(query, allEventTypes);
    onQueryChange(defaultQuery);
    return allEventTypes;
  };

  return (
    <Field label={t('components.trace-type-field.label-event-type', 'Event Type')}>
      <MultiSelect
        placeholder={t('components.trace-type-field.placeholder-event-type', 'Choose event types')}
        inputId="azure-monitor-traces-type-field"
        value={findOptions(
          [...tables, ...variableOptionGroup.options],
          query.azureTraces?.traceTypes ?? getDefaultOptions()
        )}
        onChange={handleChange}
        options={options}
        allowCustomValue
        isClearable
        aria-label={selectors.components.queryEditor.tracesQueryEditor.traceTypes.select}
      />
    </Field>
  );
};

export default TraceTypeField;

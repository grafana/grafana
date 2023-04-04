import React, { useCallback, useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';

import TimegrainConverter from '../../time_grain_converter';
import { AzureQueryEditorFieldProps, AzureMonitorOption } from '../../types';
import { addValueToOptions } from '../../utils/common';
import { Field } from '../Field';

import { setTimeGrain } from './setQueryValue';

interface TimeGrainFieldProps extends AzureQueryEditorFieldProps {
  timeGrainOptions: AzureMonitorOption[];
}

const TimeGrainField = ({ query, timeGrainOptions, variableOptionGroup, onQueryChange }: TimeGrainFieldProps) => {
  const handleChange = useCallback(
    (change: SelectableValue<string>) => {
      if (!change.value) {
        return;
      }

      const newQuery = setTimeGrain(query, change.value);
      onQueryChange(newQuery);
    },
    [onQueryChange, query]
  );

  const timeGrains = useMemo(() => {
    const autoInterval = TimegrainConverter.findClosestTimeGrain(
      '1m',
      timeGrainOptions.map((o) => TimegrainConverter.createKbnUnitFromISO8601Duration(o.value)) || [
        '1m',
        '5m',
        '15m',
        '30m',
        '1h',
        '6h',
        '12h',
        '1d',
      ]
    );

    const baseTimeGrains = timeGrainOptions.map((v) => (v.value === 'auto' ? { ...v, description: autoInterval } : v));

    const options = addValueToOptions(baseTimeGrains, variableOptionGroup, query.azureMonitor?.timeGrain);

    return options;
  }, [timeGrainOptions, variableOptionGroup, query.azureMonitor?.timeGrain]);

  return (
    <Field label="Time grain">
      <Select
        inputId="azure-monitor-metrics-time-grain-field"
        value={query.azureMonitor?.timeGrain}
        onChange={handleChange}
        options={timeGrains}
      />
    </Field>
  );
};

export default TimeGrainField;

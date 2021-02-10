import React, { useCallback, useMemo } from 'react';
import { Select } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';

import { Field } from '../Field';
import { findOption } from '../common';
import TimegrainConverter from '../../time_grain_converter';
import { AzureQueryEditorFieldProps, Option } from '../../types';

interface TimeGrainFieldProps extends AzureQueryEditorFieldProps {
  timeGrainOptions: Option[];
}

const TimeGrainField: React.FC<TimeGrainFieldProps> = ({ query, onQueryChange, timeGrainOptions }) => {
  const handleChange = useCallback(
    (change: SelectableValue<string>) => {
      if (!change.value) {
        return;
      }

      onQueryChange({
        ...query,
        azureMonitor: {
          ...query.azureMonitor,
          timeGrain: change.value,
        },
      });
    },
    [query]
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

    return timeGrainOptions.map((v) => (v.value === 'auto' ? { ...v, description: autoInterval } : v));
  }, [timeGrainOptions]);

  return (
    <Field label="Time Grain">
      <Select
        value={findOption(timeGrainOptions, query.azureMonitor.timeGrain)}
        onChange={handleChange}
        options={timeGrains}
        width={38}
      />
    </Field>
  );
};

export default TimeGrainField;

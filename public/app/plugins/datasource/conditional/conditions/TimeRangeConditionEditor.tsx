import React from 'react';

import { QueryConditionUIProps, RawTimeRange, SelectableValue } from '@grafana/data';
import { Field, Select } from '@grafana/ui';
import { quickOptions } from '@grafana/ui/src/components/DateTimePickers/options';

export interface TimeRangeConditionOptions {
  value: RawTimeRange;
}

export const TimeRangeConditionEditor: React.FC<QueryConditionUIProps<TimeRangeConditionOptions>> = ({
  onChange,
  options,
}) => {
  return (
    <Field label="Time range">
      <Select
        value={options}
        getOptionLabel={(o) => {
          return quickOptions.find((q) => q.from === o.value.from && q.to === o.value.to)?.display;
        }}
        options={quickOptions.map<SelectableValue>((o) => ({
          value: {
            from: o.from,
            to: o.to,
          },
        }))}
        onChange={(v) => {
          onChange({ ...options, value: { from: v.value.from, to: v.value.to } });
        }}
      />
    </Field>
  );
};

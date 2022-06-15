import React from 'react';

import {
  DateTime,
  TimeRange,
  ConditionInfo,
  QueryConditionID,
  QueryConditionType,
  SelectableValue,
} from '@grafana/data';
import { Select } from '@grafana/ui';
import { quickOptions } from '@grafana/ui/src/components/DateTimePickers/options';

type TimeRangeConditionOptions = {
  value: { from: DateTime; to: DateTime };
};
type TimeRangeConditionArgs = {
  currentTimeRange: TimeRange;
};

export const timeRangeCondition: ConditionInfo<TimeRangeConditionOptions, TimeRangeConditionArgs> = {
  id: QueryConditionID.TimeRange,
  type: QueryConditionType.TimeRange,
  name: 'Time range',
  description: 'When a time range is selected',
  defaultOptions: {
    value: {
      from: quickOptions[0].from,
      to: quickOptions[0].to,
    },
  },
  execute: (o, context) => {
    if (o.value.from === context.timeRange.raw.from && o.value.to === context.timeRange.raw.to) {
      return true;
    }
    return false;
  },
  editor: ({ onChange, options }) => {
    return (
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
    );
  },
  getVariableName: (options: any) => '',
};

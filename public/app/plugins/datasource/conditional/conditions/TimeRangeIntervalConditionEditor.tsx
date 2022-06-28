import React from 'react';

import { SelectableValue } from '@grafana/data';
import { Field, HorizontalGroup, Input, Select } from '@grafana/ui';

import { QueryConditionUIProps } from '../types';

export interface TimeRangeIntervalConditionOptions {
  // interval in ms
  interval: string;
  operator: OPERATOR_ID;
}

export enum OPERATOR_ID {
  LessThan = 'less_than',
  LessThanEqual = 'less_than_equal',
  GreaterThan = 'geater_than',
  GreaterThanEqual = 'greater_than_equal',
}

export const OPERATORS = [
  { id: OPERATOR_ID.LessThan, label: '<', evaluate: (value: number, compareTo: number) => value < compareTo },
  { id: OPERATOR_ID.LessThanEqual, label: '<=', evaluate: (value: number, compareTo: number) => value <= compareTo },
  { id: OPERATOR_ID.GreaterThan, label: '>', evaluate: (value: number, compareTo: number) => value > compareTo },
  { id: OPERATOR_ID.GreaterThanEqual, label: '>=', evaluate: (value: number, compareTo: number) => value >= compareTo },
];

export const TimeRangeIntervalConditionEditor: React.FC<QueryConditionUIProps<TimeRangeIntervalConditionOptions>> = ({
  onChange,
  options,
}) => {
  return (
    <Field label="Time range interval">
      <HorizontalGroup spacing="md">
        <Select
          value={options.operator}
          options={OPERATORS.map<SelectableValue<OPERATOR_ID>>((o) => ({
            label: o.label,
            value: o.id,
          }))}
          onChange={(v) => {
            onChange({ ...options, operator: v.value! });
          }}
        />
        <Input
          placeholder="Interval, i.e. 1m, 1h, 1Y"
          defaultValue={options.interval}
          onBlur={(e) => {
            onChange({ ...options, interval: e.currentTarget.value });
          }}
        />
      </HorizontalGroup>
    </Field>
  );
};

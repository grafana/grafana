import React, { FC } from 'react';
import { HorizontalGroup, InlineFormLabel, RadioButtonGroup } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { unwrap } from './unwrap';

type Mode = 'ASC' | 'DESC';
const options: Array<SelectableValue<Mode>> = [
  { label: 'ASC', value: 'ASC' },
  { label: 'DESC', value: 'DESC' },
];

type Props = {
  value: Mode;
  onChange: (value: Mode) => void;
};

export const OrderByTimeSection: FC<Props> = ({ value, onChange }) => {
  return (
    <HorizontalGroup>
      <InlineFormLabel>Order by time</InlineFormLabel>
      <RadioButtonGroup<Mode>
        options={options}
        value={value}
        onChange={(v) => {
          onChange(unwrap(v));
        }}
      />
    </HorizontalGroup>
  );
};

import React from 'react';
import { SelectableValue } from '@grafana/data';
import { unwrap } from './unwrap';
import { Select } from '@grafana/ui';

type Mode = 'ASC' | 'DESC';

const OPTIONS: Array<SelectableValue<Mode>> = [
  { label: 'ascending', value: 'ASC' },
  { label: 'descending', value: 'DESC' },
];

type Props = {
  value: Mode;
  onChange: (value: Mode) => void;
};

export const OrderByTimeSection = ({ value, onChange }: Props): JSX.Element => {
  return (
    <>
      <Select<Mode>
        className="width-9"
        onChange={(v) => {
          onChange(unwrap(v.value));
        }}
        value={value}
        options={OPTIONS}
      />
    </>
  );
};

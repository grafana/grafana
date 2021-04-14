import React, { FC } from 'react';
import { RadioButtonGroup } from '@grafana/ui';
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
    <div className="gf-form-inline">
      <label className="gf-form-label query-keyword width-9">Order by time</label>
      <RadioButtonGroup<Mode>
        options={options}
        value={value}
        onChange={(v) => {
          onChange(unwrap(v));
        }}
      />
      <div className="gf-form gf-form--grow">
        <label className="gf-form-label gf-form-label--grow"></label>
      </div>
    </div>
  );
};

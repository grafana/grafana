import React from 'react';
import { cx } from '@emotion/css';
import { SelectableValue } from '@grafana/data';
import { unwrap } from './unwrap';
import { Select } from '@grafana/ui';
import { paddingRightClass } from './styles';

type Mode = 'ASC' | 'DESC';

const OPTIONS: Array<SelectableValue<Mode>> = [
  { label: 'ascending', value: 'ASC' },
  { label: 'descending', value: 'DESC' },
];

const className = cx('width-9', paddingRightClass);

type Props = {
  value: Mode;
  onChange: (value: Mode) => void;
};

export const OrderByTimeSection = ({ value, onChange }: Props): JSX.Element => {
  return (
    <>
      <Select<Mode>
        className={className}
        onChange={(v) => {
          onChange(unwrap(v.value));
        }}
        value={value}
        options={OPTIONS}
      />
    </>
  );
};

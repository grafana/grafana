import { cx } from '@emotion/css';
import React from 'react';

import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';

import { unwrap } from '../utils/unwrap';

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
  inputId?: string;
};

export const OrderByTimeSection = ({ value, onChange, inputId }: Props): JSX.Element => {
  return (
    <>
      <Select<Mode>
        inputId={inputId}
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

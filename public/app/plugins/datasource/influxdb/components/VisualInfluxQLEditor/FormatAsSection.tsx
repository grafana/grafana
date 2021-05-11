import { Select } from '@grafana/ui';
import { cx } from '@emotion/css';
import { ResultFormat } from '../../types';
import React from 'react';
import { unwrap } from './unwrap';
import { RESULT_FORMATS } from '../constants';
import { paddingRightClass } from './styles';

type Props = {
  format: ResultFormat;
  onChange: (newFormat: ResultFormat) => void;
};

const className = cx('width-8', paddingRightClass);

export const FormatAsSection = ({ format, onChange }: Props): JSX.Element => {
  return (
    <Select<ResultFormat>
      className={className}
      onChange={(v) => {
        onChange(unwrap(v.value));
      }}
      value={format}
      options={RESULT_FORMATS}
    />
  );
};

import { cx } from '@emotion/css';
import React from 'react';

import { Select } from '@grafana/ui';

import { ResultFormat } from '../../../../../types';
import { RESULT_FORMATS } from '../../../constants';
import { unwrap } from '../utils/unwrap';

import { paddingRightClass } from './styles';

type Props = {
  inputId?: string;
  format: ResultFormat;
  onChange: (newFormat: ResultFormat) => void;
};

const className = cx('width-8', paddingRightClass);

export const FormatAsSection = ({ format, inputId, onChange }: Props): JSX.Element => {
  return (
    <Select<ResultFormat>
      inputId={inputId}
      className={className}
      onChange={(v) => {
        onChange(unwrap(v.value));
      }}
      value={format}
      options={RESULT_FORMATS}
    />
  );
};

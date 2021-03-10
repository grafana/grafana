import { Select } from '@grafana/ui';
import { ResultFormat } from '../../types';
import React from 'react';
import { unwrap } from './unwrap';
import { RESULT_FORMATS } from '../constants';

type Props = {
  format: ResultFormat;
  onChange: (newFormat: ResultFormat) => void;
};

export const FormatAsSection = ({ format, onChange }: Props): JSX.Element => {
  return (
    <>
      <Select<ResultFormat>
        className="width-8"
        onChange={(v) => {
          onChange(unwrap(v.value));
        }}
        value={format}
        options={RESULT_FORMATS}
      />
    </>
  );
};

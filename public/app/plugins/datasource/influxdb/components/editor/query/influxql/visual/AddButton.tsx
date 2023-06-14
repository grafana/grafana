import React from 'react';

import { SelectableValue } from '@grafana/data';

import { unwrap } from '../utils/unwrap';

import { Seg } from './Seg';

type Props = {
  loadOptions: () => Promise<SelectableValue[]>;
  allowCustomValue?: boolean;
  onAdd: (v: string) => void;
};

export const AddButton = ({ loadOptions, allowCustomValue, onAdd }: Props): JSX.Element => {
  return (
    <Seg
      value="+"
      loadOptions={loadOptions}
      allowCustomValue={allowCustomValue}
      onChange={(v) => {
        onAdd(unwrap(v.value));
      }}
    />
  );
};

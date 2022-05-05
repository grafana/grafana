import { debounce } from 'lodash';
import React, { FunctionComponent, useState } from 'react';

import { Input } from '@grafana/ui';

import { INPUT_WIDTH } from '../constants';

import { QueryEditorRow } from '.';

export interface Props {
  refId: string;
  onChange: (alias: any) => void;
  value?: string;
}

export const AliasBy: FunctionComponent<Props> = ({ refId, value = '', onChange }) => {
  const [alias, setAlias] = useState(value ?? '');

  const propagateOnChange = debounce(onChange, 1000);

  onChange = (e: any) => {
    setAlias(e.target.value);
    propagateOnChange(e.target.value);
  };

  return (
    <QueryEditorRow label="Alias by" htmlFor={`${refId}-alias-by`}>
      <Input id={`${refId}-alias-by`} width={INPUT_WIDTH} value={alias} onChange={onChange} />
    </QueryEditorRow>
  );
};

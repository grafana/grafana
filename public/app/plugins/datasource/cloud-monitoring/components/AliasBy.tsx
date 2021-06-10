import React, { FunctionComponent, useState } from 'react';
import { debounce } from 'lodash';
import { Input } from '@grafana/ui';
import { QueryEditorRow } from '.';
import { INPUT_WIDTH } from '../constants';

export interface Props {
  onChange: (alias: any) => void;
  value?: string;
}

export const AliasBy: FunctionComponent<Props> = ({ value = '', onChange }) => {
  const [alias, setAlias] = useState(value ?? '');

  const propagateOnChange = debounce(onChange, 1000);

  onChange = (e: any) => {
    setAlias(e.target.value);
    propagateOnChange(e.target.value);
  };

  return (
    <QueryEditorRow label="Alias by">
      <Input width={INPUT_WIDTH} value={alias} onChange={onChange} />
    </QueryEditorRow>
  );
};

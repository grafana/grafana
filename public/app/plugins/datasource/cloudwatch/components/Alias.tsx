import React, { FunctionComponent, useState } from 'react';
import { debounce } from 'lodash';
import { Input } from '@grafana/ui';

export interface Props {
  onChange: (alias: any) => void;
  value: string;
}

export const Alias: FunctionComponent<Props> = ({ value = '', onChange }) => {
  const [alias, setAlias] = useState(value);

  const propagateOnChange = debounce(onChange, 1500);

  onChange = (e: any) => {
    setAlias(e.target.value);
    propagateOnChange(e.target.value);
  };

  return <Input type="text" className="gf-form-input width-16" value={alias} onChange={onChange} />;
};

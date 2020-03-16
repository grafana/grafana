import React, { FunctionComponent, useState } from 'react';
import { debounce } from 'lodash';
import { Input } from '@grafana/ui';
import { QueryInlineField } from '.';

export interface Props {
  onChange: (alias: any) => void;
  value: string;
}

export const AliasBy: FunctionComponent<Props> = ({ value = '', onChange }) => {
  const [alias, setAlias] = useState(value);

  const propagateOnChange = debounce(onChange, 1000);

  onChange = (e: any) => {
    setAlias(e.target.value);
    propagateOnChange(e.target.value);
  };

  return (
    <QueryInlineField label="Alias By">
      <Input type="text" className="gf-form-input width-16" value={alias} onChange={onChange} />
    </QueryInlineField>
  );
};

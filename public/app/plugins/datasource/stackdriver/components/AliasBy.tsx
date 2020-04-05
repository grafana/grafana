import React, { FunctionComponent, useState } from 'react';
import { debounce } from 'lodash';
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
      <input type="text" className="gf-form-input width-26" value={alias} onChange={onChange} />
    </QueryInlineField>
  );
};

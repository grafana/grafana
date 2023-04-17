import { debounce } from 'lodash';
import React, { useState } from 'react';

import { EditorField } from '@grafana/experimental';
import { Input } from '@grafana/ui';

export interface Props {
  refId: string;
  onChange: (alias: any) => void;
  value?: string;
}

export const AliasBy = ({ refId, value = '', onChange }: Props) => {
  const [alias, setAlias] = useState(value ?? '');

  const propagateOnChange = debounce(onChange, 1000);

  onChange = (e: any) => {
    setAlias(e.target.value);
    propagateOnChange(e.target.value);
  };

  return (
    <EditorField label="Alias by">
      <Input id={`${refId}-alias-by`} value={alias} onChange={onChange} />
    </EditorField>
  );
};

import { debounce } from 'lodash';
import { useState } from 'react';
import * as React from 'react';

import { EditorField } from '@grafana/plugin-ui';
import { Input } from '@grafana/ui';

export interface Props {
  refId: string;
  onChange: (alias: string) => void;
  value?: string;
}

export const AliasBy = ({ refId, value = '', onChange }: Props) => {
  const [alias, setAlias] = useState(value ?? '');

  const propagateOnChange = debounce(onChange, 1000);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAlias(e.currentTarget.value);
    propagateOnChange(e.currentTarget.value);
  };

  return (
    <EditorField label="Alias by">
      <Input id={`${refId}-alias-by`} value={alias} onChange={onInputChange} />
    </EditorField>
  );
};

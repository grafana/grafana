import { debounce } from 'lodash';
import React, { FunctionComponent, useState } from 'react';

import { EditorField, Input } from '@grafana/ui';

import { SELECT_WIDTH } from '../../constants';

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
    <EditorField label="Alias by">
      <Input id={`${refId}-alias-by`} width={SELECT_WIDTH} value={alias} onChange={onChange} />
    </EditorField>
  );
};

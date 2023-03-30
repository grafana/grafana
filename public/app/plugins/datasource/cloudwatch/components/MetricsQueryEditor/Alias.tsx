import { debounce } from 'lodash';
import React, { useState } from 'react';

import { IconButton, Input, Tooltip } from '@grafana/ui';

export interface Props {
  onChange: (alias: any) => void;
  value: string;
  id?: string;
}

export const Alias = ({ value = '', onChange, id }: Props) => {
  const [alias, setAlias] = useState(value);

  const propagateOnChange = debounce(onChange, 1500);

  onChange = (e: any) => {
    setAlias(e.target.value);
    propagateOnChange(e.target.value);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <Input id={id} type="text" value={alias} onChange={onChange} aria-label="Optional alias" />
      <Tooltip
        content={
          <span>
            Alias pattern will be deprecated in Grafana 10. See{' '}
            <a
              target="__blank"
              rel="noopener noreferrer"
              href="https://grafana.com/docs/grafana/latest/datasources/aws-cloudwatch/query-editor/#common-query-editor-fields"
            >
              documentation
            </a>{' '}
            for how to use dynamic labels.
          </span>
        }
        interactive
        theme="error"
        placement="right"
      >
        <IconButton name="exclamation-triangle" variant="destructive" style={{ marginLeft: 4 }} />
      </Tooltip>
    </div>
  );
};

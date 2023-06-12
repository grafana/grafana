import React, { useRef } from 'react';

import { MonacoQueryFieldLazy } from './MonacoQueryFieldLazy';
import { Props as MonacoProps } from './MonacoQueryFieldProps';

export type Props = Omit<MonacoProps, 'onRunQuery' | 'onBlur'> & {
  onChange: (query: string) => void;
  onRunQuery: () => void;
  onQueryType?: (query: string) => void;
};

export const MonacoQueryFieldWrapper = (props: Props) => {
  const lastRunValueRef = useRef<string | null>(null);
  const { onRunQuery, onChange, ...rest } = props;

  const handleRunQuery = (value: string) => {
    lastRunValueRef.current = value;
    onChange(value);
    onRunQuery();
  };

  const handleBlur = (value: string) => {
    onChange(value);
  };

  return <MonacoQueryFieldLazy onRunQuery={handleRunQuery} onBlur={handleBlur} {...rest} />;
};

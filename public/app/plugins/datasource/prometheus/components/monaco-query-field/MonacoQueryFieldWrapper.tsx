import React, { useRef } from 'react';

import { PromQuery } from '../../types';

import { MonacoQueryFieldLazy } from './MonacoQueryFieldLazy';
import { Props as MonacoProps } from './MonacoQueryFieldProps';

type Props = Omit<MonacoProps, 'onRunQuery' | 'onBlur' | 'queries'> & {
  onChange: (query: string) => void;
  onRunQuery: () => void;
  queries?: PromQuery[];
  query: PromQuery
};

export const MonacoQueryFieldWrapper = (props: Props) => {
  const lastRunValueRef = useRef<string | null>(null);
  const { onRunQuery, onChange, queries, query, ...rest } = props;

  const handleRunQuery = (value: string) => {
    lastRunValueRef.current = value;
    onChange(value);
    onRunQuery();
  };

  const handleBlur = (value: string) => {
    onChange(value);
  };

  /**
   * Handles changes without running any queries
   * @param value
   */
  const handleChange = (value: string) => {
    onChange(value);
  };

  return (
    <MonacoQueryFieldLazy
      query={query}
      queries={queries}
      onChange={handleChange}
      onRunQuery={handleRunQuery}
      onBlur={handleBlur}
      {...rest}
    />
  );
};

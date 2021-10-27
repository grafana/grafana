import React, { useRef } from 'react';
import { MonacoQueryFieldLazy } from './MonacoQueryFieldLazy';
import { Props as MonacoProps } from './MonacoQueryFieldProps';

type Props = Omit<MonacoProps, 'onRunQuery' | 'onBlur'> & {
  onChange: (query: string) => void;
  onRunQuery: () => void;
  onBlur?: () => void;
  isExplore: boolean;
};

export const MonacoQueryFieldWrapper = (props: Props) => {
  const lastRunValueRef = useRef<string | null>(null);
  const { isExplore, onBlur, onRunQuery, onChange, ...rest } = props;

  const handleRunQuery = (value: string) => {
    lastRunValueRef.current = value;
    onChange(value);
    onRunQuery();
  };

  const handleBlur = (value: string) => {
    onBlur?.();

    if (!isExplore) {
      // run handleRunQuery only if the current value is different from the last-time-executed value
      if (value !== lastRunValueRef.current) {
        handleRunQuery(value);
      }
    }
  };

  return <MonacoQueryFieldLazy onRunQuery={handleRunQuery} onBlur={handleBlur} {...rest} />;
};

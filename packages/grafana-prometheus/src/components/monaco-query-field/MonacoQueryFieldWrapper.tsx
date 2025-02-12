// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/components/monaco-query-field/MonacoQueryFieldWrapper.tsx
import { useRef } from 'react';

import { MonacoQueryFieldLazy } from './MonacoQueryFieldLazy';
import { Props as MonacoProps } from './MonacoQueryFieldProps';

type Props = Omit<MonacoProps, 'onRunQuery' | 'onBlur'> & {
  onChange: (query: string) => void;
  onRunQuery: () => void;
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

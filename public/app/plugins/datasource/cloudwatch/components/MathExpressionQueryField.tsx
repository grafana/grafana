import React from 'react';
import { Input } from '@grafana/ui';

export interface Props {
  onChange: (query: string) => void;
  onRunQuery: () => void;
  expression: string;
}

export function MathExpressionQueryField({ expression: query, onChange, onRunQuery }: React.PropsWithChildren<Props>) {
  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && (event.shiftKey || event.ctrlKey)) {
      event.preventDefault();
      onRunQuery();
    }
  };

  return (
    <Input
      name="Query"
      value={query}
      placeholder="Enter a math expression"
      onBlur={onRunQuery}
      onChange={(e) => onChange(e.currentTarget.value)}
      onKeyDown={onKeyDown}
    />
  );
}

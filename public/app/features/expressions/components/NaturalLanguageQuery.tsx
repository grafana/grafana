import React from 'react';

import { CodeEditor } from '@grafana/ui';

import { ExpressionQuery } from '../types';

interface Props {
  query: ExpressionQuery;
  onChange: (query: ExpressionQuery) => void;
}

export const NaturalLanguageQuery = ({ query, onChange }: Props) => {
  const onBlur = (expression: string) => {
    onChange({
      ...query,
      expression,
    });
  };

  return (
    <div>
      <CodeEditor language="txt" value={query.expression || ''} height={240} onBlur={onBlur} />
    </div>
  );
};

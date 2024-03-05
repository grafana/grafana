import React, { useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { SQLEditor } from '@grafana/experimental';

import { ExpressionQuery } from '../types';

interface Props {
  refIds: Array<SelectableValue<string>>;
  query: ExpressionQuery;
  onChange: (query: ExpressionQuery) => void;
}

export const AskExpr = ({ onChange, refIds, query }: Props) => {
  const vars = useMemo(() => refIds.map((v) => v.value!), [refIds]);

  const initialQuery = `What is the count of ${vars[0]}?`;

  const onEditorChange = (expression: string) => {
    onChange({
      ...query,
      expression,
    });
  };

  return <SQLEditor language={{ id: 'txt' }} query={query.expression || initialQuery} onChange={onEditorChange} />;
};

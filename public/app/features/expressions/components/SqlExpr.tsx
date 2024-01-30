import React, { useMemo } from 'react';

import { SelectableValue } from '@grafana/data';

// import { PRQLEditor } from '../../dashboard/components/TransformationsEditor/PRQLEditor';
import { ExpressionQuery } from '../types';
import { SQLEditor } from '@grafana/experimental';

interface Props {
  refIds: Array<SelectableValue<string>>;
  query: ExpressionQuery;
  onChange: (query: ExpressionQuery) => void;
}

export const SqlExpr = ({ onChange, refIds, query }: Props) => {
  const vars = useMemo(() => refIds.map((v) => v.value!), [refIds]);

  const initialQuery = `select * from ${vars[0]} limit 1`;

  const onEditorChange = (expression: string) => {
    onChange({
      ...query,
      expression,
    });
  };

  // return <PRQLEditor onEditorChange={onEditorChange} queryString={initialQuery} metricNames={vars}></PRQLEditor>;

  return <SQLEditor query={query.expression || initialQuery} onChange={onEditorChange}></SQLEditor>
};
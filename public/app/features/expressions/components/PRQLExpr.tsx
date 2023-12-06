import React, { useMemo } from 'react';

import { SelectableValue } from '@grafana/data';

import { PRQLEditor } from '../../dashboard/components/TransformationsEditor/PRQLEditor';
import { ExpressionQuery } from '../types';

interface Props {
  refIds: Array<SelectableValue<string>>;
  query: ExpressionQuery;
  onChange: (query: ExpressionQuery) => void;
}

export const PRQLExpr = ({ onChange, refIds, query }: Props) => {
  const vars = useMemo(() => refIds.map((v) => v.value!), [refIds]);

  const onEditorChange = (expression: string) => {
    onChange({
      ...query,
      expression,
    });
  };

  return <PRQLEditor onEditorChange={onEditorChange} queryString={query.expression} metricNames={vars} />;
};

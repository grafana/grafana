import React from 'react';

import { SelectableValue } from '@grafana/data';

import { PRQLEditor } from '../../dashboard/components/TransformationsEditor/PRQLEditor';
import { ExpressionQuery } from '../types';

interface Props {
  labelWidth: number | 'auto';
  refIds: Array<SelectableValue<string>>;
  query: ExpressionQuery;
  onChange: (query: ExpressionQuery) => void;
}

export const PRQLExpr = ({ labelWidth, onChange, refIds, query }: Props) => {
  const initialQuery =
    query.prql?.rawQuery ||
    `from ${refIds[0].value}
  filter 'time' > @2021-01-01
  take 1..20`;

  const onEditorChange = (queryString: string) => {
    onChange({
      ...query,
      prql: {
        ...query.prql,
        rawQuery: queryString,
      },
    });
  };

  return (
    <>
      <PRQLEditor
        onEditorChange={onEditorChange}
        queryString={initialQuery}
        metricNames={['metric1', 'metric2']}
      ></PRQLEditor>
    </>
  );
};

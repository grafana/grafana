import React from 'react';

import { SelectableValue } from '@grafana/data';
import { InlineField, InlineFieldRow, Select } from '@grafana/ui';

import { PRQLEditor } from '../../dashboard/components/TransformationsEditor/PRQLEditor';
import { ExpressionQuery } from '../types';

interface Props {
  labelWidth: number | 'auto';
  refIds: Array<SelectableValue<string>>;
  query: ExpressionQuery;
  onChange: (query: ExpressionQuery) => void;
}

export const PRQLExpr = ({ labelWidth, onChange, refIds, query }: Props) => {
  const onRefIdChange = (value: SelectableValue<string>) => {
    onChange({
      ...query,
      expression: value.value,
      prql: {
        rawQuery: `from A
        filter 'time' > @2021-01-01
        take 1..20`,
      },
    });
  };

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
      <InlineFieldRow>
        <InlineField label="Input" labelWidth={labelWidth}>
          <Select onChange={onRefIdChange} options={refIds} value={query.expression} width={20} />
        </InlineField>
      </InlineFieldRow>
      <PRQLEditor
        onEditorChange={onEditorChange}
        queryString={query.prql?.rawQuery}
        metricNames={['metric1', 'metric2']}
      ></PRQLEditor>
    </>
  );
};

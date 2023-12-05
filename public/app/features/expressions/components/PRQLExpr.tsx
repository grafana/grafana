import React from 'react';

import { SelectableValue } from '@grafana/data';
import { InlineField, InlineFieldRow, Select } from '@grafana/ui';

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
        rawQuery: `Something set here!!! (${Date.now()})`,
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
      <InlineFieldRow>
        <div>
          HELLO!!! expressions editor (PRQL)
          <code>{JSON.stringify(query.prql ?? {})}</code>
        </div>
      </InlineFieldRow>
    </>
  );
};

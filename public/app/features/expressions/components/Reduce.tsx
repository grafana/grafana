import React, { FC } from 'react';
import { SelectableValue } from '@grafana/data';
import { InlineField, InlineFieldRow, Select } from '@grafana/ui';
import { ExpressionQuery, reducerTypes } from '../types';

interface Props {
  labelWidth: number;
  refIds: Array<SelectableValue<string>>;
  query: ExpressionQuery;
  onChange: (query: ExpressionQuery) => void;
}

export const Reduce: FC<Props> = ({ labelWidth, onChange, refIds, query }) => {
  const reducer = reducerTypes.find((o) => o.value === query.reducer);

  const onRefIdChange = (value: SelectableValue<string>) => {
    onChange({ ...query, expression: value.value });
  };

  const onSelectReducer = (value: SelectableValue<string>) => {
    onChange({ ...query, reducer: value.value });
  };

  return (
    <InlineFieldRow>
      <InlineField label="Function" labelWidth={labelWidth}>
        <Select menuShouldPortal options={reducerTypes} value={reducer} onChange={onSelectReducer} width={25} />
      </InlineField>
      <InlineField label="Input" labelWidth={labelWidth}>
        <Select menuShouldPortal onChange={onRefIdChange} options={refIds} value={query.expression} width={20} />
      </InlineField>
    </InlineFieldRow>
  );
};

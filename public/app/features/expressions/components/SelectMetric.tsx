import React, { ChangeEvent, FC } from 'react';
import { SelectableValue } from '@grafana/data';
import { InlineField, InlineFieldRow, Select, Input } from '@grafana/ui';
import { ExpressionQuery } from '../types';

interface Props {
  labelWidth: number;
  refIds: Array<SelectableValue<string>>;
  query: ExpressionQuery;
  onChange: (query: ExpressionQuery) => void;
}

export const SelectMetric: FC<Props> = ({ labelWidth, onChange, refIds, query }) => {
  const onRefIdChange = (value: SelectableValue<string>) => {
    onChange({ ...query, expression: value.value });
  };

  const onMetricNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, metricName: event.target.value });
    console.log(query);
  };

  return (
    <InlineFieldRow>
      <InlineField label="Input" labelWidth={labelWidth}>
        <Select onChange={onRefIdChange} options={refIds} value={query.expression} width={20} />
      </InlineField>
      <InlineField label="Metric" labelWidth={labelWidth}>
        <Input onChange={onMetricNameChange} value={query.metricName} width={20} />
      </InlineField>
    </InlineFieldRow>
  );
};

import React, { ChangeEvent, FC } from 'react';
import { SelectableValue } from '@grafana/data';
import { InlineField, InlineFieldRow, Select, Input, Checkbox } from '@grafana/ui';
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
  };

  const onIsRegexChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, isRegex: event.target.checked });
  };

  const onLabelMatchersChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, labelMatchers: event.target.value });
  };

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Input" labelWidth={labelWidth}>
          <Select onChange={onRefIdChange} options={refIds} value={query.expression} width={20} />
        </InlineField>
        <InlineField label="Regex" labelWidth={labelWidth}>
          <Checkbox onChange={onIsRegexChange} value={query.isRegex} />
        </InlineField>
        <InlineField label="Metric" labelWidth={labelWidth}>
          <Input onChange={onMetricNameChange} value={query.metricName} width={20} />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Label Matchers" labelWidth={labelWidth}>
          <Input onChange={onLabelMatchersChange} value={query.labelMatchers} width={30} />
        </InlineField>
      </InlineFieldRow>
    </>
  );
};

import React, { ChangeEvent } from 'react';

import { SelectableValue } from '@grafana/data';
import { InlineField, InlineFieldRow, Input, Select } from '@grafana/ui';

import { downsamplingTypes, ExpressionQuery, upsamplingTypes } from '../types';

interface Props {
  refIds: Array<SelectableValue<string>>;
  query: ExpressionQuery;
  labelWidth?: number | 'auto';
  onChange: (query: ExpressionQuery) => void;
}

export const Resample = ({ labelWidth = 'auto', onChange, refIds, query }: Props) => {
  const downsampler = downsamplingTypes.find((o) => o.value === query.downsampler);
  const upsampler = upsamplingTypes.find((o) => o.value === query.upsampler);

  const onWindowChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, window: event.target.value });
  };

  const onRefIdChange = (value: SelectableValue<string>) => {
    onChange({ ...query, expression: value.value });
  };

  const onSelectDownsampler = (value: SelectableValue<string>) => {
    onChange({ ...query, downsampler: value.value });
  };

  const onSelectUpsampler = (value: SelectableValue<string>) => {
    onChange({ ...query, upsampler: value.value });
  };

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Input" labelWidth={labelWidth}>
          <Select onChange={onRefIdChange} options={refIds} value={query.expression} width={20} />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Resample to" labelWidth={labelWidth} tooltip="10s, 1m, 30m, 1h">
          <Input onChange={onWindowChange} value={query.window} width={15} />
        </InlineField>
        <InlineField label="Downsample">
          <Select options={downsamplingTypes} value={downsampler} onChange={onSelectDownsampler} width={25} />
        </InlineField>
        <InlineField label="Upsample">
          <Select options={upsamplingTypes} value={upsampler} onChange={onSelectUpsampler} width={25} />
        </InlineField>
      </InlineFieldRow>
    </>
  );
};

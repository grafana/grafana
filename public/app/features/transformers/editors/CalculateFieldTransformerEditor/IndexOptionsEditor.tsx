import * as React from 'react';

import { CalculateFieldTransformerOptions } from '@grafana/data/internal';
import { InlineField, InlineSwitch } from '@grafana/ui';

import { LABEL_WIDTH } from './constants';

export const IndexOptionsEditor = (props: {
  options: CalculateFieldTransformerOptions;
  onChange: (options: CalculateFieldTransformerOptions) => void;
}) => {
  const { options, onChange } = props;
  const { index } = options;

  const onToggleRowIndexAsPercentile = (e: React.FormEvent<HTMLInputElement>) => {
    onChange({
      ...options,
      index: {
        asPercentile: e.currentTarget.checked,
      },
    });
  };
  return (
    <>
      <InlineField labelWidth={LABEL_WIDTH} label="As percentile" tooltip="Transform the row index as a percentile.">
        <InlineSwitch value={!!index?.asPercentile} onChange={onToggleRowIndexAsPercentile} />
      </InlineField>
    </>
  );
};

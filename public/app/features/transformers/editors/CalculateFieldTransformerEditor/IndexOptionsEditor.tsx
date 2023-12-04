import React from 'react';

import { CalculateFieldTransformerOptions } from '@grafana/data/src/transformations/transformers/calculateField';
import { InlineField, InlineSwitch } from '@grafana/ui';

import { LABEL_WIDTH } from './constants';

export const IndexOptionsEditor = (props: {
  options: CalculateFieldTransformerOptions;
  onChange: (options: CalculateFieldTransformerOptions) => void;
}) => {
  const { options, onChange } = props;
  const { index } = options;

  const prqlString = (percentileChecked: boolean) => {
    if (percentileChecked) {
      return `
        derive const = 0
        derive quantile = (row_number foobar) / (count const)
        select !{const}
      `;
    }
    return `
      derive const = 0
      derive {row_count = count const}
      select !{const}
    `;
  };

  const onToggleRowIndexAsPercentile = (e: React.FormEvent<HTMLInputElement>) => {
    onChange({
      ...options,
      index: {
        asPercentile: e.currentTarget.checked,
      },
      prql: prqlString(e.currentTarget.checked),
    });
  };
  return (
    <>
      <p>{JSON.stringify(options)}</p>
      <InlineField labelWidth={LABEL_WIDTH} label="As percentile" tooltip="Transform the row index as a percentile.">
        <InlineSwitch value={!!index?.asPercentile} onChange={onToggleRowIndexAsPercentile} />
      </InlineField>
    </>
  );
};

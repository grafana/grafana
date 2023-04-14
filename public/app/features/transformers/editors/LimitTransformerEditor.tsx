import React, { FormEvent, useCallback } from 'react';

import { DataTransformerID, standardTransformers, TransformerRegistryItem, TransformerUIProps } from '@grafana/data';
import { LimitTransformerOptions } from '@grafana/data/src/transformations/transformers/limit';
import { InlineField, InlineFieldRow, Input } from '@grafana/ui';

export const LimitTransformerEditor = ({ options, onChange }: TransformerUIProps<LimitTransformerOptions>) => {
  const onSetLimit = useCallback(
    (value: FormEvent<HTMLInputElement>) => {
      onChange({
        ...options,
        limitField: Number(value.currentTarget.value),
      });
    },
    [onChange, options]
  );

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Limit" labelWidth={8}>
          <Input
            placeholder="Limit count"
            pattern="[0-9]*"
            value={options.limitField}
            onChange={onSetLimit}
            width={25}
          />
        </InlineField>
      </InlineFieldRow>
    </>
  );
};

export const limitTransformRegistryItem: TransformerRegistryItem<LimitTransformerOptions> = {
  id: DataTransformerID.limit,
  editor: LimitTransformerEditor,
  transformation: standardTransformers.limitTransformer,
  name: 'Limit',
  description: `Limit the number of items displayed.`,
};

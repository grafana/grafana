import React, { useCallback } from 'react';

import {
  DataTransformerID,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
  VariableOrigin,
} from '@grafana/data';
import { LimitTransformerOptions } from '@grafana/data/src/transformations/transformers/limit';
import { getTemplateSrv } from '@grafana/runtime';
import { InlineFieldRow } from '@grafana/ui';

import { SuggestionsInput } from '../suggestionsInput/SuggestionsInput';

export const LimitTransformerEditor = ({ options, onChange }: TransformerUIProps<LimitTransformerOptions>) => {
  const onSetLimit = useCallback(
    (value: string) => {
      onChange({
        ...options,
        limitField: value,
      });
    },
    [onChange, options]
  );

  const templateSrv = getTemplateSrv();
  const variables = templateSrv.getVariables().map((v) => {
    return { value: v.name, label: v.label || v.name, origin: VariableOrigin.Template };
  });

  return (
    <>
      <InlineFieldRow>
        <SuggestionsInput
          value={String(options.limitField)}
          onChange={onSetLimit}
          placeholder="Value or variable"
          suggestions={variables}
        ></SuggestionsInput>
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
  categories: new Set([TransformerCategory.Filter]),
};

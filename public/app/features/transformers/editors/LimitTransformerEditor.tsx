import React, { useCallback, useState } from 'react';

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
import { numberOrVariableValidator } from '../utils';

export const LimitTransformerEditor = ({ options, onChange }: TransformerUIProps<LimitTransformerOptions>) => {
  const [isInvalid, setInvalid] = useState<boolean>(false);

  const onSetLimit = useCallback(
    (value: string) => {
      setInvalid(!numberOrVariableValidator(value));
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
          invalid={isInvalid}
          error={'Value needs to be an integer or a variable'}
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

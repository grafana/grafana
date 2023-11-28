import React, { FormEvent, useCallback, useState } from 'react';

import {
  DataTransformerID,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
  VariableOrigin,
} from '@grafana/data';
import { LimitTransformerOptions } from '@grafana/data/src/transformations/transformers/limit';
import { getTemplateSrv, config as cfg } from '@grafana/runtime';
import { InlineField, InlineFieldRow, Input } from '@grafana/ui';

import { getTransformationContent } from '../docs/getTransformationContent';
import { SuggestionsInput } from '../suggestionsInput/SuggestionsInput';
import { numberOrVariableValidator } from '../utils';

export const LimitTransformerEditor = ({ options, onChange }: TransformerUIProps<LimitTransformerOptions>) => {
  const [isInvalid, setInvalid] = useState<boolean>(false);

  const onSetLimit = useCallback(
    (value: FormEvent<HTMLInputElement>) => {
      onChange({
        ...options,
        limitField: Number(value.currentTarget.value),
      });
    },
    [onChange, options]
  );

  const onSetVariableLimit = useCallback(
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

  if (!cfg.featureToggles.transformationsVariableSupport) {
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
  }
  return (
    <>
      <InlineFieldRow>
        <SuggestionsInput
          invalid={isInvalid}
          error={'Value needs to be an integer or a variable'}
          value={String(options.limitField)}
          onChange={onSetVariableLimit}
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
  name: standardTransformers.limitTransformer.name,
  description: `Limit the number of items displayed.`,
  categories: new Set([TransformerCategory.Filter]),
  help: getTransformationContent(DataTransformerID.limit).helperDocs,
};

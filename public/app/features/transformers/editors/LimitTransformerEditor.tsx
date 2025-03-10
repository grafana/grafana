import { useCallback, useState } from 'react';

import {
  DataTransformerID,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
} from '@grafana/data';
import { LimitTransformerOptions } from '@grafana/data/src/transformations/transformers/limit';
import { InlineFieldRow } from '@grafana/ui';

import { getTransformationContent } from '../docs/getTransformationContent';
import { SuggestionsInput } from '../suggestionsInput/SuggestionsInput';
import { getVariableSuggestions, numberOrVariableValidator } from '../utils';

export const LimitTransformerEditor = ({ options, onChange }: TransformerUIProps<LimitTransformerOptions>) => {
  const [isInvalid, setInvalid] = useState<boolean>(false);

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

  return (
    <>
      <InlineFieldRow>
        <SuggestionsInput
          invalid={isInvalid}
          error={'Value needs to be an integer or a variable'}
          value={String(options.limitField)}
          onChange={onSetVariableLimit}
          placeholder="Value or variable"
          suggestions={getVariableSuggestions()}
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

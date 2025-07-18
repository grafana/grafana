import { useCallback, useState } from 'react';

import {
  DataTransformerID,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
} from '@grafana/data';
import { LimitTransformerOptions } from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { InlineFieldRow } from '@grafana/ui';

import { getTransformationContent } from '../docs/getTransformationContent';
import darkImage from '../images/dark/limit.svg';
import lightImage from '../images/light/limit.svg';
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
          placeholder={t('transformers.limit-transformer-editor.placeholder-value-or-variable', 'Value or variable')}
          suggestions={getVariableSuggestions()}
        ></SuggestionsInput>
      </InlineFieldRow>
    </>
  );
};

export const getLimitTransformRegistryItem: () => TransformerRegistryItem<LimitTransformerOptions> = () => ({
  id: DataTransformerID.limit,
  editor: LimitTransformerEditor,
  transformation: standardTransformers.limitTransformer,
  name: t('transformers.limit-transformer-editor.name.limit', 'Limit'),
  description: t(
    'transformers.limit-transformer-editor.description.limit-number-items-displayed',
    'Limit the number of items displayed.'
  ),
  categories: new Set([TransformerCategory.Filter]),
  help: getTransformationContent(DataTransformerID.limit).helperDocs,
  imageDark: darkImage,
  imageLight: lightImage,
});

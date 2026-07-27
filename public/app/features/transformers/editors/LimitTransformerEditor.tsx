import { useCallback, useState } from 'react';

import { type TransformerUIProps } from '@grafana/data';
import { type LimitTransformerOptions } from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { InlineFieldRow } from '@grafana/ui';

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

import { useCallback, useState } from 'react';
import * as React from 'react';

import { ValueMatcherID, RangeValueMatcherOptions } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { InlineLabel } from '@grafana/ui';

import { SuggestionsInput } from '../../suggestionsInput/SuggestionsInput';
import { getVariableSuggestions, numberOrVariableValidator } from '../../utils';

import { ValueMatcherEditorConfig, ValueMatcherUIProps, ValueMatcherUIRegistryItem } from './types';

type PropNames = 'from' | 'to';

export function rangeMatcherEditor<T = string | number>(
  config: ValueMatcherEditorConfig
): React.FC<ValueMatcherUIProps<RangeValueMatcherOptions<T>>> {
  return function RangeMatcherEditor({ options, onChange }) {
    const { validator } = config;
    const [isInvalid, setInvalid] = useState({
      from: !validator(options.from),
      to: !validator(options.to),
    });

    const onChangeOptionsSuggestions = useCallback(
      (value: string, prop: PropNames) => {
        const invalid = !validator(value);

        setInvalid({
          ...isInvalid,
          [prop]: invalid,
        });

        if (invalid) {
          return;
        }

        onChange({
          ...options,
          [prop]: value,
        });
      },
      [options, onChange, isInvalid, setInvalid, validator]
    );

    const suggestions = getVariableSuggestions();

    return (
      <>
        <SuggestionsInput
          value={String(options.from)}
          invalid={isInvalid.from}
          error={'Value needs to be a number or a variable'}
          placeholder={t('transformers.range-matcher-editor.placeholder-from', 'From')}
          onChange={(val) => onChangeOptionsSuggestions(val, 'from')}
          suggestions={suggestions}
        />
        <InlineLabel>
          <Trans i18nKey="transformers.range-matcher-editor.and">and</Trans>
        </InlineLabel>
        <SuggestionsInput
          invalid={isInvalid.to}
          error={'Value needs to be a number or a variable'}
          value={String(options.to)}
          placeholder={t('transformers.range-matcher-editor.placeholder-to', 'To')}
          suggestions={suggestions}
          onChange={(val) => onChangeOptionsSuggestions(val, 'to')}
        />
      </>
    );
  };
}

export const getRangeValueMatchersUI = (): Array<ValueMatcherUIRegistryItem<RangeValueMatcherOptions>> => {
  return [
    {
      name: 'Is between',
      id: ValueMatcherID.between,
      component: rangeMatcherEditor<string | number>({
        validator: numberOrVariableValidator,
      }),
    },
  ];
};

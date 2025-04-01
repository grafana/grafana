import { useCallback, useState } from 'react';
import * as React from 'react';

import { ValueMatcherID, BasicValueMatcherOptions } from '@grafana/data';
import { t } from 'app/core/internationalization';

import { SuggestionsInput } from '../../suggestionsInput/SuggestionsInput';
import { getVariableSuggestions } from '../../utils';

import { ValueMatcherEditorConfig, ValueMatcherUIProps, ValueMatcherUIRegistryItem } from './types';

export function regexMatcherEditor(
  config: ValueMatcherEditorConfig
): React.FC<ValueMatcherUIProps<BasicValueMatcherOptions<string>>> {
  return function Render({ options, onChange }) {
    const { validator } = config;
    const { value } = options;
    const [isInvalid, setInvalid] = useState(!validator(value));

    const onChangeVariableValue = useCallback(
      (value: string) => {
        setInvalid(!validator(value));
        onChange({
          ...options,
          value,
        });
      },
      [setInvalid, validator, onChange, options]
    );

    return (
      <SuggestionsInput
        invalid={isInvalid}
        value={value}
        onChange={onChangeVariableValue}
        placeholder={t('transformers.regex-matcher-editor.placeholder-value-or-variable', 'Value or variable')}
        suggestions={getVariableSuggestions()}
      />
    );
  };
}

export const getRegexValueMatchersUI = (): Array<ValueMatcherUIRegistryItem<BasicValueMatcherOptions>> => {
  return [
    {
      name: 'Regex',
      id: ValueMatcherID.regex,
      component: regexMatcherEditor({
        validator: () => true,
      }),
    },
  ];
};

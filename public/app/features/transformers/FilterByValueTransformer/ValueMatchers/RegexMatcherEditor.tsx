import { useCallback, useState } from 'react';
import * as React from 'react';

import { ValueMatcherID, BasicValueMatcherOptions, VariableSuggestion } from '@grafana/data';
import { t } from '@grafana/i18n';

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
    const variableSuggestions = getVariableSuggestions().reduce<VariableSuggestion[]>((acc, v) => {
      acc.push(v);
      acc.push({
        ...v,
        documentation: t(
          'transformers.regex-matcher-editor.variable-regex-documentation',
          'Formats multi-value variable into a regex string'
        ),
        label: v.label.concat(':regex'),
        value: v.value.concat(':regex'),
      });
      return acc;
    }, []);

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
        suggestions={variableSuggestions}
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

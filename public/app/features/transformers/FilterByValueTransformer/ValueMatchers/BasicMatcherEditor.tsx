import { useCallback, useState } from 'react';
import * as React from 'react';

import { ValueMatcherID, BasicValueMatcherOptions } from '@grafana/data';
import { t } from '@grafana/i18n';

import { SuggestionsInput } from '../../suggestionsInput/SuggestionsInput';
import { getVariableSuggestions, numberOrVariableValidator } from '../../utils';

import { ValueMatcherEditorConfig, ValueMatcherUIProps, ValueMatcherUIRegistryItem } from './types';

export function basicMatcherEditor<T = any>(
  config: ValueMatcherEditorConfig
): React.FC<ValueMatcherUIProps<BasicValueMatcherOptions>> {
  return function Render({ options, onChange }) {
    const { validator } = config;
    const { value } = options;
    const [isInvalid, setInvalid] = useState(!validator(value));

    const onChangeVariableValue = useCallback(
      (value: string) => {
        setInvalid(!validator(value));
        onChange({
          ...options,
          value: value,
        });
      },
      [setInvalid, validator, onChange, options]
    );

    return (
      <SuggestionsInput
        invalid={isInvalid}
        value={value}
        error={'Value needs to be a number or a variable'}
        onChange={onChangeVariableValue}
        placeholder={t('transformers.basic-matcher-editor.placeholder-value-or-variable', 'Value or variable')}
        suggestions={getVariableSuggestions()}
      />
    );
  };
}

export const getBasicValueMatchersUI = (): Array<ValueMatcherUIRegistryItem<BasicValueMatcherOptions>> => {
  return [
    {
      name: 'Is greater',
      id: ValueMatcherID.greater,
      component: basicMatcherEditor<string | number>({
        validator: numberOrVariableValidator,
      }),
    },
    {
      name: 'Is greater or equal',
      id: ValueMatcherID.greaterOrEqual,
      component: basicMatcherEditor<string | number>({
        validator: numberOrVariableValidator,
      }),
    },
    {
      name: 'Is lower',
      id: ValueMatcherID.lower,
      component: basicMatcherEditor<string | number>({
        validator: numberOrVariableValidator,
      }),
    },
    {
      name: 'Is lower or equal',
      id: ValueMatcherID.lowerOrEqual,
      component: basicMatcherEditor<string | number>({
        validator: numberOrVariableValidator,
      }),
    },
    {
      name: 'Is equal',
      id: ValueMatcherID.equal,
      component: basicMatcherEditor<string | number | boolean>({
        validator: () => true,
      }),
    },
    {
      name: 'Is not equal',
      id: ValueMatcherID.notEqual,
      component: basicMatcherEditor<string | number | boolean>({
        validator: () => true,
      }),
    },
    {
      name: 'Is Substring',
      id: ValueMatcherID.substring,
      component: basicMatcherEditor<string | number | boolean>({
        validator: () => true,
      }),
    },
    {
      name: 'Is not substring',
      id: ValueMatcherID.notSubstring,
      component: basicMatcherEditor<string | number | boolean>({
        validator: () => true,
      }),
    },
  ];
};

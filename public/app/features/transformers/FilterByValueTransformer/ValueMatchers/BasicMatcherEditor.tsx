import React, { useCallback, useState } from 'react';

import { ValueMatcherID, BasicValueMatcherOptions, VariableOrigin } from '@grafana/data';
import { getTemplateSrv, config as cfg } from '@grafana/runtime';
import { Input } from '@grafana/ui';

import { SuggestionsInput } from '../../suggestionsInput/SuggestionsInput';
import { numberOrVariableValidator } from '../../utils';

import { ValueMatcherEditorConfig, ValueMatcherUIProps, ValueMatcherUIRegistryItem } from './types';
import { convertToType } from './utils';

export function basicMatcherEditor<T = any>(
  config: ValueMatcherEditorConfig
): React.FC<ValueMatcherUIProps<BasicValueMatcherOptions>> {
  return function Render({ options, onChange, field }) {
    const { validator, converter = convertToType } = config;
    const { value } = options;
    const [isInvalid, setInvalid] = useState(!validator(value));

    const templateSrv = getTemplateSrv();
    const variables = templateSrv.getVariables().map((v) => {
      return { value: v.name, label: v.label || v.name, origin: VariableOrigin.Template };
    });

    const onChangeValue = useCallback(
      (event: React.FormEvent<HTMLInputElement>) => {
        setInvalid(!validator(event.currentTarget.value));
      },
      [setInvalid, validator]
    );

    const onChangeOptions = useCallback(
      (event: React.FocusEvent<HTMLInputElement>) => {
        if (isInvalid) {
          return;
        }

        const { value } = event.currentTarget;

        onChange({
          ...options,
          value: converter(value, field),
        });
      },
      [options, onChange, isInvalid, field, converter]
    );

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

    if (cfg.featureToggles.transformationsVariableSupport) {
      return (
        <SuggestionsInput
          invalid={isInvalid}
          value={value}
          error={'Value needs to be an integer or a variable'}
          onChange={onChangeVariableValue}
          placeholder="Value or variable"
          suggestions={variables}
        ></SuggestionsInput>
      );
    } else {
      return (
        <Input
          className="flex-grow-1"
          invalid={isInvalid}
          defaultValue={String(options.value)}
          placeholder="Value"
          onChange={onChangeValue}
          onBlur={onChangeOptions}
        />
      );
    }
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

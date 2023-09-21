import { css } from '@emotion/css';
import React, { useCallback, useState } from 'react';

import { ValueMatcherID, BasicValueMatcherOptions, VariableOrigin } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { Field } from '@grafana/ui';

import { SuggestionsInput } from '../../suggestionsInput/SuggestionsInput';

import { ValueMatcherEditorConfig, ValueMatcherUIProps, ValueMatcherUIRegistryItem } from './types';

export function basicMatcherEditor<T = any>(
  config: ValueMatcherEditorConfig
): React.FC<ValueMatcherUIProps<BasicValueMatcherOptions>> {
  return function Render({ options, onChange, field }) {
    const { validator } = config;
    const { value } = options;
    const [isInvalid, setInvalid] = useState(!validator(value));

    const templateSrv = getTemplateSrv();
    const variables = templateSrv.getVariables().map((v) => {
      return { value: v.name, label: v.label || v.name, origin: VariableOrigin.Template };
    });

    const onChangeValue = useCallback(
      (value: string) => {
        setInvalid(!validator(value));
        onChange({
          ...options,
          value: value,
        });
      },
      [setInvalid, validator, onChange, options]
    );

    //TODO: make regex matcher use a simple input, witaout suggestions.
    //Also exclude from actual transformation operation
    return (
      <Field
        invalid={isInvalid}
        error={'Value needs to be an integer or a variable'}
        className={css({ width: '100%' })}
      >
        <SuggestionsInput
          invalid={isInvalid}
          value={value}
          onChange={onChangeValue}
          placeholder="Value or variable"
          suggestions={variables}
        ></SuggestionsInput>
      </Field>
    );
  };
}

export function numberOrVariableValidator(value: string | number) {
  if (typeof value === 'number') {
    return true;
  }
  if (!Number.isNaN(Number(value))) {
    return true;
  }
  if (/^\$\{[A-Za-z0-9_]+\}$/.test(value)) {
    return true;
  }
  return false;
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
      name: 'Regex',
      id: ValueMatcherID.regex,
      component: basicMatcherEditor<string>({
        validator: () => true,
        converter: (value) => String(value),
      }),
    },
  ];
};

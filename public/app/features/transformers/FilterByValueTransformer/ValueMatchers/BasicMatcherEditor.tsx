import React, { useCallback, useState } from 'react';

import { ValueMatcherID, BasicValueMatcherOptions } from '@grafana/data';
import { Input } from '@grafana/ui';

import { ValueMatcherEditorConfig, ValueMatcherUIProps, ValueMatcherUIRegistryItem } from './types';
import { convertToType } from './utils';

export function basicMatcherEditor<T = any>(
  config: ValueMatcherEditorConfig
): React.FC<ValueMatcherUIProps<BasicValueMatcherOptions<T>>> {
  return function Render({ options, onChange, field }) {
    const { validator, converter = convertToType } = config;
    const { value } = options;
    const [isInvalid, setInvalid] = useState(!validator(value));

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
  };
}

export const getBasicValueMatchersUI = (): Array<ValueMatcherUIRegistryItem<BasicValueMatcherOptions>> => {
  return [
    {
      name: 'Is greater',
      id: ValueMatcherID.greater,
      component: basicMatcherEditor<number>({
        validator: (value) => !isNaN(value),
      }),
    },
    {
      name: 'Is greater or equal',
      id: ValueMatcherID.greaterOrEqual,
      component: basicMatcherEditor<number>({
        validator: (value) => !isNaN(value),
      }),
    },
    {
      name: 'Is lower',
      id: ValueMatcherID.lower,
      component: basicMatcherEditor<number>({
        validator: (value) => !isNaN(value),
      }),
    },
    {
      name: 'Is lower or equal',
      id: ValueMatcherID.lowerOrEqual,
      component: basicMatcherEditor<number>({
        validator: (value) => !isNaN(value),
      }),
    },
    {
      name: 'Is equal',
      id: ValueMatcherID.equal,
      component: basicMatcherEditor<any>({
        validator: () => true,
      }),
    },
    {
      name: 'Is not equal',
      id: ValueMatcherID.notEqual,
      component: basicMatcherEditor<any>({
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

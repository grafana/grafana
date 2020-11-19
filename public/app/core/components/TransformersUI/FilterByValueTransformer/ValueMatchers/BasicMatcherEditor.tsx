import React, { useCallback, useState } from 'react';
import { Input } from '@grafana/ui';
import { BasicValueMatcherOptions } from '@grafana/data/src/transformations/matchers/valueMatchers/types';
import { ValueMatcherUIProps, ValueMatcherUIRegistryItem, ValueMatcherValidator } from './types';
import { ValueMatcherID } from '@grafana/data';
import { isNumber, isUndefined } from 'lodash';

interface EditorConfig<T> {
  defaultValue: T;
  validator: ValueMatcherValidator<BasicValueMatcherOptions>;
}

export function basicMatcherEditor<T = any>(
  config: EditorConfig<T>
): React.FC<ValueMatcherUIProps<BasicValueMatcherOptions<T>>> {
  return ({ options, onChange }) => {
    const { validator, defaultValue } = config;
    const [isInvalid, setInvalid] = useState(validator(options));

    const onChangeValue = useCallback(
      (event: React.FormEvent<HTMLInputElement>) => {
        setInvalid(
          !validator({
            ...options,
            value: event.currentTarget.value,
          })
        );
      },
      [setInvalid, validator]
    );

    const onChangeOptions = useCallback(
      (event: React.FocusEvent<HTMLInputElement>) => {
        if (isInvalid) {
          return;
        }
        onChange({
          ...options,
          value: convertToType(defaultValue, event.currentTarget.value),
        });
      },
      [options, onChange, isInvalid]
    );

    return (
      <div className="gf-form gf-form--grow gf-form-spacing ">
        <Input
          className="flex-grow-1"
          invalid={isInvalid}
          defaultValue={String(options.value ?? defaultValue)}
          placeholder="Value"
          onChange={onChangeValue}
          onBlur={onChangeOptions}
        />
      </div>
    );
  };
}

function convertToType<T>(defaultValue: T, value?: string) {
  if (isUndefined(value)) {
    return defaultValue;
  }

  if (isNumber(defaultValue)) {
    return (parseInt(value, 10) as any) as T;
  }

  return (value as any) as T;
}

export const getBasicValueMatchers = (): Array<ValueMatcherUIRegistryItem<BasicValueMatcherOptions>> => {
  return [
    {
      name: 'Is greater',
      id: ValueMatcherID.greater,
      component: basicMatcherEditor<number>({
        defaultValue: 0,
        validator: options => {
          return !isNaN(options.value);
        },
      }),
    },
  ];
};

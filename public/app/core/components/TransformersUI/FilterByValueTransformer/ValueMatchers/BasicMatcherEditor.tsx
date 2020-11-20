import React, { useCallback, useState } from 'react';
import { Input } from '@grafana/ui';
import { BasicValueMatcherOptions } from '@grafana/data/src/transformations/matchers/valueMatchers/types';
import { ValueMatcherUIProps, ValueMatcherUIRegistryItem, ValueMatcherValidator } from './types';
import { ValueMatcherID } from '@grafana/data';
import { convertToType } from './utils';

interface BasicEditorConfig {
  validator: ValueMatcherValidator<BasicValueMatcherOptions>;
}

export function basicMatcherEditor<T = any>(
  config: BasicEditorConfig
): React.FC<ValueMatcherUIProps<BasicValueMatcherOptions<T>>> {
  return ({ options, onChange, field }) => {
    const { validator } = config;
    const [isInvalid, setInvalid] = useState(!validator(options));

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

        const { value } = event.currentTarget;

        onChange({
          ...options,
          value: convertToType(value, field),
        });
      },
      [options, onChange, isInvalid, field]
    );

    return (
      <div className="gf-form gf-form--grow gf-form-spacing ">
        <Input
          className="flex-grow-1"
          invalid={isInvalid}
          defaultValue={String(options.value)}
          placeholder="Value"
          onChange={onChangeValue}
          onBlur={onChangeOptions}
        />
      </div>
    );
  };
}

export const getBasicValueMatchersUI = (): Array<ValueMatcherUIRegistryItem<BasicValueMatcherOptions>> => {
  return [
    {
      name: 'Is greater',
      id: ValueMatcherID.greater,
      component: basicMatcherEditor<number>({
        validator: options => {
          return !isNaN(options.value);
        },
      }),
    },
    {
      name: 'Is greater or equal',
      id: ValueMatcherID.greaterOrEqual,
      component: basicMatcherEditor<number>({
        validator: options => {
          return !isNaN(options.value);
        },
      }),
    },
    {
      name: 'Is lower',
      id: ValueMatcherID.lower,
      component: basicMatcherEditor<number>({
        validator: options => {
          return !isNaN(options.value);
        },
      }),
    },
    {
      name: 'Is lower or equal',
      id: ValueMatcherID.lowerOrEqual,
      component: basicMatcherEditor<number>({
        validator: options => {
          return !isNaN(options.value);
        },
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
  ];
};

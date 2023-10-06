import React, { useCallback, useState } from 'react';

import { ValueMatcherID, BasicValueMatcherOptions } from '@grafana/data';
import { Input } from '@grafana/ui';

import { ValueMatcherEditorConfig, ValueMatcherUIProps, ValueMatcherUIRegistryItem } from './types';
import { convertToType } from './utils';

export function regexMatcherEditor(
  config: ValueMatcherEditorConfig
): React.FC<ValueMatcherUIProps<BasicValueMatcherOptions<string>>> {
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

export const getRegexValueMatchersUI = (): Array<ValueMatcherUIRegistryItem<BasicValueMatcherOptions>> => {
  return [
    {
      name: 'Regex',
      id: ValueMatcherID.regex,
      component: regexMatcherEditor({
        validator: () => true,
        converter: (value) => String(value),
      }),
    },
  ];
};

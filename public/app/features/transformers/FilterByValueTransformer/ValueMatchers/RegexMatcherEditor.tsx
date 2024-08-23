import { useCallback, useState } from 'react';
import * as React from 'react';

import { ValueMatcherID, BasicValueMatcherOptions, VariableOrigin } from '@grafana/data';
import { config as cfg, getTemplateSrv } from '@grafana/runtime';
import { Input } from '@grafana/ui';

import { SuggestionsInput } from '../../suggestionsInput/SuggestionsInput';

import { ValueMatcherEditorConfig, ValueMatcherUIProps, ValueMatcherUIRegistryItem } from './types';
import { convertToType } from './utils';

export function regexMatcherEditor(
  config: ValueMatcherEditorConfig
): React.FC<ValueMatcherUIProps<BasicValueMatcherOptions<string>>> {
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

    if (cfg.featureToggles.transformationsVariableSupport) {
      return (
        <SuggestionsInput
          invalid={isInvalid}
          value={value}
          onChange={onChangeVariableValue}
          placeholder="Value or variable"
          suggestions={variables}
        />
      );
    }

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

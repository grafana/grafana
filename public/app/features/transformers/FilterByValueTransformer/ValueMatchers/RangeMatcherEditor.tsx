import React, { useCallback, useState } from 'react';

import { ValueMatcherID, RangeValueMatcherOptions, VariableOrigin } from '@grafana/data';
import { getTemplateSrv, config as cfg } from '@grafana/runtime';
import { Input } from '@grafana/ui';

import { SuggestionsInput } from '../../suggestionsInput/SuggestionsInput';
import { numberOrVariableValidator } from '../../utils';

import { ValueMatcherEditorConfig, ValueMatcherUIProps, ValueMatcherUIRegistryItem } from './types';
import { convertToType } from './utils';

type PropNames = 'from' | 'to';

export function rangeMatcherEditor<T = any>(
  config: ValueMatcherEditorConfig
): React.FC<ValueMatcherUIProps<RangeValueMatcherOptions<T>>> {
  return function RangeMatcherEditor({ options, onChange, field }) {
    const { validator } = config;
    const [isInvalid, setInvalid] = useState({
      from: !validator(options.from),
      to: !validator(options.to),
    });

    const templateSrv = getTemplateSrv();
    const variables = templateSrv.getVariables().map((v) => {
      return { value: v.name, label: v.label || v.name, origin: VariableOrigin.Template };
    });

    const onChangeValue = useCallback(
      (event: React.FormEvent<HTMLInputElement>, prop: PropNames) => {
        setInvalid({
          ...isInvalid,
          [prop]: !validator(event.currentTarget.value),
        });
      },
      [setInvalid, validator, isInvalid]
    );

    const onChangeOptions = useCallback(
      (event: React.FocusEvent<HTMLInputElement>, prop: PropNames) => {
        if (isInvalid[prop]) {
          return;
        }

        const { value } = event.currentTarget;

        onChange({
          ...options,
          [prop]: convertToType(value, field),
        });
      },
      [options, onChange, isInvalid, field]
    );

    const onChangeOptionsSuggestions = useCallback(
      (value: string, prop: PropNames) => {
        const invalid = !validator(value);

        setInvalid({
          ...isInvalid,
          [prop]: invalid,
        });

        if (invalid) {
          return;
        }

        onChange({
          ...options,
          [prop]: value,
        });
      },
      [options, onChange, isInvalid, setInvalid, validator]
    );
    if (cfg.featureToggles.transformationsVariableSupport) {
      return (
        <>
          <SuggestionsInput
            value={String(options.from)}
            invalid={isInvalid.from}
            error={'Value needs to be an integer or a variable'}
            placeholder="From"
            onChange={(val) => onChangeOptionsSuggestions(val, 'from')}
            suggestions={variables}
          />
          <div className="gf-form-label">and</div>
          <SuggestionsInput
            invalid={isInvalid.to}
            error={'Value needs to be an integer or a variable'}
            value={String(options.to)}
            placeholder="To"
            suggestions={variables}
            onChange={(val) => onChangeOptionsSuggestions(val, 'to')}
          />
        </>
      );
    }
    return (
      <>
        <Input
          className="flex-grow-1 gf-form-spacing"
          invalid={isInvalid['from']}
          defaultValue={String(options.from)}
          placeholder="From"
          onChange={(event) => onChangeValue(event, 'from')}
          onBlur={(event) => onChangeOptions(event, 'from')}
        />
        <div className="gf-form-label">and</div>
        <Input
          className="flex-grow-1"
          invalid={isInvalid['to']}
          defaultValue={String(options.to)}
          placeholder="To"
          onChange={(event) => onChangeValue(event, 'to')}
          onBlur={(event) => onChangeOptions(event, 'to')}
        />
      </>
    );
  };
}

export const getRangeValueMatchersUI = (): Array<ValueMatcherUIRegistryItem<RangeValueMatcherOptions>> => {
  return [
    {
      name: 'Is between',
      id: ValueMatcherID.between,
      component: rangeMatcherEditor<string | number>({
        validator: numberOrVariableValidator,
      }),
    },
  ];
};

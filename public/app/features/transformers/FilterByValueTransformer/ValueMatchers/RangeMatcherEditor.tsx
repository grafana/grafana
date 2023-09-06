import React, { useCallback, useState } from 'react';

import { ValueMatcherID, RangeValueMatcherOptions, VariableOrigin } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';

import { SuggestionsInput } from '../../suggestionsInput/SuggestionsInput';

import { ValueMatcherEditorConfig, ValueMatcherUIProps, ValueMatcherUIRegistryItem } from './types';

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
      (value: string, prop: PropNames) => {
        setInvalid({
          ...isInvalid,
          [prop]: !validator(value),
        });
      },
      [setInvalid, validator, isInvalid]
    );

    const onChangeOptions = useCallback(
      (value: string, prop: PropNames) => {
        if (isInvalid[prop]) {
          return;
        }

        onChange({
          ...options,
          [prop]: value,
        });
      },
      [options, onChange, isInvalid]
    );

    return (
      <>
        <SuggestionsInput
          className="flex-grow-1 gf-form-spacing"
          value={String(options.from)}
          placeholder="From"
          onChange={(val) => onChangeOptions(val, 'from')}
          suggestions={variables}
        />
        <div className="gf-form-label">and</div>
        <SuggestionsInput
          className="flex-grow-1"
          value={String(options.to)}
          placeholder="To"
          suggestions={variables}
          onChange={(val) => onChangeOptions(val, 'to')}
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
        validator: () => true,
      }),
    },
  ];
};

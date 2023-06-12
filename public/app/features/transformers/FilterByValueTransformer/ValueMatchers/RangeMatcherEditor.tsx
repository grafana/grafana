import React, { useCallback, useState } from 'react';

import { ValueMatcherID, RangeValueMatcherOptions } from '@grafana/data';
import { Input } from '@grafana/ui';

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
      component: rangeMatcherEditor<number>({
        validator: (value) => {
          return !isNaN(value);
        },
      }),
    },
  ];
};

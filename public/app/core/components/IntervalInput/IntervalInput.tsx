import React, { useState } from 'react';
import { useDebounce } from 'react-use';

import { InlineField, InlineFieldRow, Input } from '@grafana/ui';

import { validateInterval } from './validation';

interface Props {
  label: string;
  tooltip: string;
  value: string;
  onChange: (val: string) => void;
  isInvalidError: string;
  disabled?: boolean;
}

export function IntervalInput(props: Props) {
  const [intervalIsInvalid, setIntervalIsInvalid] = useState(() => {
    return props.value ? validateInterval(props.value) : false;
  });

  useDebounce(
    () => {
      setIntervalIsInvalid(validateInterval(props.value));
    },
    500,
    [props.value]
  );

  return (
    <InlineFieldRow>
      <InlineField
        label={props.label}
        labelWidth={26}
        disabled={props.disabled ?? false}
        grow
        tooltip={props.tooltip}
        invalid={intervalIsInvalid}
        error={props.isInvalidError}
      >
        <Input
          type="text"
          placeholder="0"
          width={40}
          onChange={(e) => {
            props.onChange(e.currentTarget.value);
          }}
          value={props.value}
        />
      </InlineField>
    </InlineFieldRow>
  );
}

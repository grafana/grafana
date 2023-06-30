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
  const [interval, setInterval] = useState(props.value);
  const [intervalIsInvalid, setIntervalIsInvalid] = useState(() => {
    return props.value ? validateInterval(props.value) : false;
  });

  useDebounce(
    () => {
      setIntervalIsInvalid(validateInterval(interval));
    },
    500,
    [interval]
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
            setInterval(e.currentTarget.value);
            props.onChange(e.currentTarget.value);
          }}
          value={interval}
        />
      </InlineField>
    </InlineFieldRow>
  );
}

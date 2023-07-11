import React, { useState } from 'react';
import { useDebounce } from 'react-use';

import { InlineField, Input } from '@grafana/ui';

import { validateInterval } from './validation';

interface Props {
  value: string;
  onChange: (val: string) => void;
  isInvalidError: string;
  label?: string;
  tooltip?: string;
  disabled?: boolean;
  width?: number;
  placeholder?: string;
  ariaLabel?: string;
}

interface FieldProps {
  labelWidth: number;
  disabled: boolean;
  invalid: boolean;
  error: string;
  label?: string;
  tooltip?: string;
}

export const IntervalInput = (props: Props) => {
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

  const fieldProps: FieldProps = {
    labelWidth: 26,
    disabled: props.disabled ?? false,
    invalid: intervalIsInvalid,
    error: props.isInvalidError,
  };
  if (props.label) {
    fieldProps.label = props.label;
    fieldProps.tooltip = props.tooltip || '';
  }

  return (
    <InlineField {...fieldProps}>
      <Input
        type="text"
        placeholder={props.placeholder || '0'}
        width={props.width || 40}
        onChange={(e) => {
          props.onChange(e.currentTarget.value);
        }}
        value={props.value}
        aria-label={props.ariaLabel || 'interval input'}
      />
    </InlineField>
  );
};

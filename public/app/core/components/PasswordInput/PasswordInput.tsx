import React, { forwardRef } from 'react';
import { Input, FormLabel } from '@grafana/ui';

export interface Props {
  label: string;
  labelClassName?: string;
  inputClassName?: string;
  value: string | undefined;
  onChange: (value: string) => void;
}

export const PasswordInput = forwardRef<HTMLInputElement, Props>((props, ref) => (
  <>
    <FormLabel className={props.labelClassName}>{props.label}</FormLabel>
    <Input
      className={props.inputClassName}
      type="password"
      onChange={event => props.onChange(event.target.value)}
      value={props.value}
    />
  </>
));

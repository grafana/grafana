import React, { ChangeEvent, forwardRef } from 'react';
import { Input, FormLabel } from '@grafana/ui';

export interface Props {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
}

export const PasswordInput = forwardRef<HTMLInputElement, Props>((props, ref) => (
  <>
    <FormLabel className="width-8">{props.label}</FormLabel>
    <Input
      className="gf-form-input max-width-22"
      type="password"
      onChange={(event: ChangeEvent<HTMLInputElement>) => props.onChange(event.target.value)}
      value={props.value}
    />
  </>
));

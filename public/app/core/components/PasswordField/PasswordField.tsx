import React, { FC, useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Input, IconButton } from '@grafana/ui';

export interface Props {
  autoFocus?: boolean;
  autoComplete?: string;
  id?: string;
  passwordHint?: string;
}

export const PasswordField: FC<Props> = React.forwardRef<HTMLInputElement, Props>(
  ({ autoComplete, autoFocus, id, passwordHint, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);

    return (
      <Input
        id={id}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        {...props}
        type={showPassword ? 'text' : 'password'}
        placeholder={passwordHint}
        aria-label={selectors.pages.Login.password}
        ref={ref}
        suffix={
          <IconButton
            name={showPassword ? 'eye-slash' : 'eye'}
            type="button"
            aria-controls={id}
            role="switch"
            aria-checked={showPassword}
            aria-label="Show password"
            onClick={() => {
              setShowPassword(!showPassword);
            }}
          />
        }
      />
    );
  }
);

PasswordField.displayName = 'PasswordField';

import React, { FC, useState } from 'react';
import { selectors } from '@grafana/e2e-selectors';

import { Input, IconButton } from '@grafana/ui';

export interface Props {
  autoFocus?: boolean;
  autoComplete?: string;
  id?: string;
  passwordHint?: string;
}

export const PasswordField: FC<Props> = ({ autoComplete, autoFocus, id, passwordHint, ...props }) => {
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
      suffix={
        <IconButton
          name={showPassword ? 'eye-slash' : 'eye'}
          surface="header"
          onClick={(e) => {
            e.preventDefault();
            setShowPassword(!showPassword);
          }}
        />
      }
    />
  );
};

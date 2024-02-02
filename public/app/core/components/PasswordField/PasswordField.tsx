import React, { useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Input, IconButton } from '@grafana/ui';
import { Props as InputProps } from '@grafana/ui/src/components/Input/Input';

interface Props extends Omit<InputProps, 'type'> {}

export const PasswordField = React.forwardRef<HTMLInputElement, Props>((props, ref) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Input
      {...props}
      type={showPassword ? 'text' : 'password'}
      data-testid={selectors.pages.Login.password}
      ref={ref}
      suffix={
        <IconButton
          name={showPassword ? 'eye-slash' : 'eye'}
          aria-controls={props.id}
          role="switch"
          aria-checked={showPassword}
          onClick={() => {
            setShowPassword(!showPassword);
          }}
          tooltip={showPassword ? 'Hide password' : 'Show password'}
        />
      }
    />
  );
});

PasswordField.displayName = 'PasswordField';

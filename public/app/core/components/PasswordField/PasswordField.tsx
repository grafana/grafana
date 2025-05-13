import { forwardRef, useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Input, IconButton } from '@grafana/ui';
import { InputProps } from '@grafana/ui/internal';

import { t } from '../../internationalization';

interface Props extends Omit<InputProps, 'type'> {}

export const PasswordField = forwardRef<HTMLInputElement, Props>((props, ref) => {
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
          tooltip={
            showPassword
              ? t('grafana-ui.password-field.tooltip-hide', 'Hide password')
              : t('grafana-ui.password-field.tooltip-show', 'Show password')
          }
        />
      }
    />
  );
});

PasswordField.displayName = 'PasswordField';

import React, { FC, useState } from 'react';
import { selectors } from '@grafana/e2e-selectors';

import { Input, IconButton } from '@grafana/ui';

export interface Props {
  autoFocus?: boolean;
  autoComplete?: string;
  id?: string;
  passwordHint?: string;
  register: any;
}

export const PasswordField: FC<Props> = ({ autoComplete, autoFocus, id, passwordHint, register }) => {
  const [isShowPassword, setIsShowPassword] = useState(false);

  return (
    <Input
      id={id}
      autoFocus={autoFocus}
      autoComplete={autoComplete}
      {...register}
      type={isShowPassword ? 'text' : 'password'}
      placeholder={passwordHint}
      aria-label={selectors.pages.Login.password}
      suffix={
        <IconButton
          name={isShowPassword ? 'eye-slash' : 'eye'}
          surface="header"
          onClick={(e) => {
            e.preventDefault();
            setIsShowPassword(!isShowPassword);
          }}
        />
      }
    />
  );
};

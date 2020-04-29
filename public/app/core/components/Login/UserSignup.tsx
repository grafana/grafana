import React, { FC } from 'react';
import { LinkButton } from '@grafana/ui';

export const UserSignup: FC<{}> = () => {
  return (
    <div className="login-signup-box">
      <div className="login-signup-title p-r-1">New to Grafana?</div>
      <LinkButton href="signup" variant="secondary">
        Sign Up
      </LinkButton>
    </div>
  );
};

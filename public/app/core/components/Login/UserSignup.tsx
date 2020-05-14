import React, { FC } from 'react';
import { LinkButton, HorizontalGroup } from '@grafana/ui';

export const UserSignup: FC<{}> = () => {
  return (
    <HorizontalGroup justify="flex-start">
      <LinkButton href="signup" variant="secondary">
        Sign Up
      </LinkButton>
      <span>New to Grafana?</span>
    </HorizontalGroup>
  );
};

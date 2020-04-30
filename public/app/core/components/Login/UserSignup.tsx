import React, { FC } from 'react';
import { LinkButton, HorizontalGroup } from '@grafana/ui';

export const UserSignup: FC<{}> = () => {
  return (
    <HorizontalGroup justify="flex-end">
      <span>New to Grafana?</span>
      <LinkButton href="signup" variant="secondary">
        Sign Up
      </LinkButton>
    </HorizontalGroup>
  );
};

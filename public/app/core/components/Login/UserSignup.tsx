import React, { FC } from 'react';
import { LinkButton, VerticalGroup } from '@grafana/ui';
import { css } from 'emotion';

export const UserSignup: FC<{}> = () => {
  return (
    <VerticalGroup
      className={css`
        margin-top: 8px;
      `}
    >
      <span>New to Grafana?</span>
      <LinkButton
        className={css`
          width: 100%;
          justify-content: center;
        `}
        href="signup"
        variant="secondary"
      >
        Sign Up
      </LinkButton>
    </VerticalGroup>
  );
};

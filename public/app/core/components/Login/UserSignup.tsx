import React, { FC } from 'react';
import { LinkButton, VerticalGroup } from '@grafana/ui';
import { css } from 'emotion';
import { getConfig } from 'app/core/config';

export const UserSignup: FC<{}> = () => {
  let href = getConfig().verifyEmailEnabled ? '/verify' : '/signup';
  href = getConfig().appSubUrl + href;

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
        href={href}
        variant="secondary"
      >
        Sign Up
      </LinkButton>
    </VerticalGroup>
  );
};

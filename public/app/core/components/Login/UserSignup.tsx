import { css } from '@emotion/css';
import React, { FC } from 'react';

import { LinkButton, VerticalGroup } from '@grafana/ui';
import { getConfig } from 'app/core/config';

export const UserSignup: FC<{}> = () => {
  const href = getConfig().verifyEmailEnabled ? `${getConfig().appSubUrl}/verify` : `${getConfig().appSubUrl}/signup`;
  const paddingTop = css({ paddingTop: '16px' });

  return (
    <VerticalGroup>
      <div className={paddingTop}>New to Grafana?</div>
      <LinkButton
        className={css`
          width: 100%;
          justify-content: center;
        `}
        href={href}
        variant="secondary"
        fill="outline"
      >
        Sign up
      </LinkButton>
    </VerticalGroup>
  );
};

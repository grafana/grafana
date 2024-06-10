import { css } from '@emotion/css';
import React from 'react';

import { LinkButton, VerticalGroup } from '@grafana/ui';
import { getConfig } from 'app/core/config';
import { Trans } from 'app/core/internationalization';

export const UserSignup = () => {
  const href = getConfig().verifyEmailEnabled ? `${getConfig().appSubUrl}/verify` : `${getConfig().appSubUrl}/signup`;
  const paddingTop = css({ paddingTop: '16px' });

  return (
    <VerticalGroup>
      <div className={paddingTop}>
        <Trans i18nKey="login.signup.new-to-question">New to Grafana?</Trans>
      </div>
      <LinkButton
        className={css({
          width: '100%',
          justifyContent: 'center',
        })}
        href={href}
        variant="secondary"
        fill="outline"
      >
        <Trans i18nKey="login.signup.button-label">Sign up</Trans>
      </LinkButton>
    </VerticalGroup>
  );
};

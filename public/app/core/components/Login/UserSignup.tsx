import { css } from '@emotion/css';

import { Trans } from '@grafana/i18n';
import { LinkButton, Stack } from '@grafana/ui';
import { getConfig } from 'app/core/config';

export const UserSignup = () => {
  const href = getConfig().verifyEmailEnabled ? `${getConfig().appSubUrl}/verify` : `${getConfig().appSubUrl}/signup`;
  const paddingTop = css({ paddingTop: '16px' });

  return (
    <Stack direction="column">
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
    </Stack>
  );
};

import { css } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Icon, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';

export interface Props {}

const ConfigureAuthCTA: React.FunctionComponent<Props> = () => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.container}>
      <Stack gap={1} alignItems={'center'}>
        <Icon name={'cog'} />
        <Text>
          <Trans i18nKey="auth-config.configure-auth-cta.configuration-required">Configuration required</Trans>
        </Text>
      </Stack>
      <Text variant={'bodySmall'} color={'secondary'}>
        <Trans i18nKey="auth-config.configure-auth-cta.authentication-configuration-created-moment">
          You have no authentication configuration created at the moment.
        </Trans>
      </Text>
      <TextLink href={'https://grafana.com/docs/grafana/latest/auth/overview/'} external>
        <Trans i18nKey="auth-config.configure-auth-cta.refer-documentation-configure-authentication">
          Refer to the documentation on how to configure authentication
        </Trans>
      </TextLink>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(3),
      width: 'max-content',
      margin: theme.spacing(3, 'auto'),
    }),
  };
};

export default ConfigureAuthCTA;

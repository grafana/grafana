import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/internal';
import { t, Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Text, Box, Icon, Stack, useStyles2, Button, LinkButton } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { backendSrv } from 'app/core/services/backend_srv';

export interface Props {
  page?: 'teams' | 'users';
}

export function EnterpriseAuthFeaturesCard({ page }: Props) {
  const styles = useStyles2(getStyles);
  const helpFlags = contextSrv.user.helpFlags1;
  const HELP_FLAG_ENTERPRISE_AUTH = 0x0004;
  const [isDismissed, setDismissed] = useState<boolean>(Boolean(helpFlags & HELP_FLAG_ENTERPRISE_AUTH));

  const onDismiss = () => {
    backendSrv
      .put(`/api/user/helpflags/${HELP_FLAG_ENTERPRISE_AUTH}`, undefined, { showSuccessAlert: false })
      .then((res) => {
        contextSrv.user.helpFlags1 = res.helpFlags1;
        setDismissed(true);
      });
  };

  // This card is only visible in oss
  if (isDismissed || !isOpenSourceBuildOrUnlicenced()) {
    return null;
  }

  return (
    <Box
      padding={2}
      borderColor="weak"
      borderStyle={'solid'}
      borderRadius="default"
      backgroundColor="secondary"
      display={'flex'}
      direction="column"
      gap={1.5}
      marginTop={3}
    >
      <Stack direction="row" alignItems="center" justifyContent={'space-between'}>
        <div className={styles.cloudBadge}>
          <Icon name="cloud" className={styles.icon} />
          <Trans i18nKey="admin.enterprise-auth-features-card.badge">Cloud & Enterprise</Trans>
        </div>
        <Button
          variant="secondary"
          fill="text"
          icon="times"
          onClick={onDismiss}
          aria-label={t('admin.enterprise-auth-features-card.dismiss', 'Dismiss')}
        />
      </Stack>
      <Stack direction="column" gap={0.5}>
        <Text variant="h4">
          <Trans i18nKey="admin.enterprise-auth-features-card.heading">Enterprise authentication</Trans>
        </Text>
        <Text variant="body" color="secondary">
          <Trans i18nKey="admin.enterprise-auth-features-card.text">
            You can sync users and teams with <strong>SCIM</strong>, authenticate using <strong>SAML</strong> and sync
            teams with <strong>LDAP</strong>.
          </Trans>
        </Text>
      </Stack>
      <div>
        <LinkButton
          href={`https://grafana.com/contact/enterprise-stack/?utm_source=oss-grafana-${page}`}
          icon="external-link-alt"
          variant="secondary"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Trans i18nKey="admin.enterprise-auth-features-card.learn-more-link">Learn more.</Trans>
        </LinkButton>
      </div>
    </Box>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    cloudBadge: css({
      display: 'flex',
      alignItems: 'center',
      background: theme.colors.gradients.brandHorizontal,
      color: theme.colors.primary.contrastText,
      padding: theme.spacing(0.5, 1),
      borderRadius: theme.shape.radius.pill,
      fontSize: theme.typography.bodySmall.fontSize,
      gap: theme.spacing(1),
    }),
    icon: css({
      position: 'relative',
      top: -1,
    }),
  };
}

export function isOpenSourceBuildOrUnlicenced() {
  if (config.buildInfo.edition === GrafanaEdition.OpenSource) {
    return true;
  }

  if (config.licenseInfo.stateInfo !== 'Licensed') {
    return true;
  }

  return false;
}

import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/internal';
import { t, Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { useUserStorage } from '@grafana/runtime/internal';
import { Text, Stack, useStyles2, Button, LinkButton } from '@grafana/ui';
import { CloudEnterpriseBadge } from 'app/core/components/Branding/CloudEnterpriseBadge';

export interface Props {
  page?: 'teams' | 'users';
}

export function EnterpriseAuthFeaturesCard({ page }: Props) {
  const styles = useStyles2(getStyles);
  const storage = useUserStorage('grafana-help-flags');
  const [isDismissed, setDismissed] = useState<boolean>(true);

  useEffect(() => {
    storage.getItem('enterpriseAuthCardDismissed').then((value: string | null) => {
      setDismissed(value === 'true');
    });
  }, [storage]);

  const onDismiss = async () => {
    await storage.setItem('enterpriseAuthCardDismissed', 'true');
    setDismissed(true);
  };

  // This card is only visible in oss
  if (isDismissed || !isOpenSourceBuildOrUnlicenced()) {
    return null;
  }

  return (
    <div className={styles.box}>
      <Stack direction="row" alignItems="center" justifyContent={'space-between'}>
        <CloudEnterpriseBadge />
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
            Manage users, teams, and permissions automatically with <strong>SAML</strong>, <strong>SCIM</strong>,{' '}
            <strong>LDAP</strong>, and <strong>RBAC</strong> — available in Grafana Cloud and Enterprise.
          </Trans>
        </Text>
      </Stack>
      <div>
        <LinkButton
          href={`https://grafana.com/auth/sign-up/create-user?cloud-auth=&redirectPath=cloud-auth&utm_source=oss-grafana&cnt-admin-${page}`}
          icon="external-link-alt"
          variant="secondary"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Trans i18nKey="admin.enterprise-auth-features-card.learn-more-link">Learn more</Trans>
        </LinkButton>
      </div>
    </div>
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
    box: css({
      padding: theme.spacing(3),
      border: `1px solid ${theme.colors.border.weak}`,
      backgroundColor: theme.colors.background.secondary,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1.5),
      borderRadius: theme.shape.radius.lg,
      marginTop: theme.spacing(3),
      strong: {
        color: theme.colors.text.primary,
      },
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

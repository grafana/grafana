import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Icon, Stack, Text, useStyles2 } from '@grafana/ui';

import { UPGRADE_URL } from '../constants';
import { isFreeTierLicense } from '../utils/isFreeTierLicense';

export interface FreeTierLimitNoteProps {
  /** The type of limit to display: connection limit or resource limit */
  limitType?: 'connection' | 'resource';
}

/**
 * Displays a free tier limit notification with an icon and "Note:" prefix
 * Only visible for free tier users
 */
export function FreeTierLimitNote({ limitType = 'resource' }: FreeTierLimitNoteProps) {
  const styles = useStyles2(getStyles);

  if (!isFreeTierLicense()) {
    return null;
  }

  return (
    <Stack direction="row" alignItems="flex-start">
      <Icon name="exclamation-triangle" className={styles.warningIcon} size="sm" />
      <Text variant="bodySmall">
        <Trans i18nKey="provisioning.free-tier-limit.note">Note:</Trans>{' '}
        {limitType === 'connection' ? (
          <Trans i18nKey="provisioning.free-tier-limit.message-connection">
            Free-tier accounts are limited to 1 connection. To add more connections,
          </Trans>
        ) : (
          <Trans i18nKey="provisioning.free-tier-limit.message-resource">
            Free-tier accounts are limited to 20 resources per folder. To add more resources,
          </Trans>
        )}{' '}
        {/* We are using a custom "a" tag here instead of the TextLink component because we need the link text to wrap*/}
        <a href={UPGRADE_URL} target="_blank" rel="noopener noreferrer" className={styles.link}>
          <Trans i18nKey="provisioning.free-tier-limit.upgrade-link">upgrade your account</Trans>{' '}
          <Icon name="external-link-alt" size="xs" />
        </a>
        .
      </Text>
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    warningIcon: css({
      color: theme.colors.warning.text,
      marginTop: theme.spacing(0.25),
    }),
    link: css({
      color: theme.colors.text.link,
      textDecoration: 'underline',
      '&:hover': {
        color: theme.colors.text.link,
        textDecoration: 'none',
      },
    }),
  };
};

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Icon, Stack, Text, useStyles2 } from '@grafana/ui';

import { isFreeTierLicense } from '../utils/isFreeTierLicense';

/**
 * Displays a free tier limit notification with an icon and "Note:" prefix
 * Only visible for free tier users
 */
export function FreeTierLimitNote() {
  const styles = useStyles2(getStyles);

  if (!isFreeTierLicense()) {
    return null;
  }

  return (
    <Stack direction="row" alignItems="flex-start">
      <Icon name="exclamation-triangle" className={styles.warningIcon} />
      <Text variant="bodySmall">
        <Trans i18nKey="provisioning.free-tier-limit.note">Note:</Trans>{' '}
        <Trans i18nKey="provisioning.free-tier-limit.messages">
          Free-tier accounts are capped to 1 connection, and 20 resources per folder. To add more connections, upgrade
          your account.
        </Trans>
      </Text>
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    warningIcon: css({
      color: theme.colors.warning.text,
    }),
  };
};

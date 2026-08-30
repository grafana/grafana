import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Icon, Stack, Text, useStyles2 } from '@grafana/ui';

import { QuotaLimitMessage } from './QuotaLimitMessage';

interface QuotaLimitNoteProps {
  maxRepositories?: number;
  maxResourcesPerRepository?: number;
}

export function QuotaLimitNote({ maxRepositories = 0, maxResourcesPerRepository = 0 }: QuotaLimitNoteProps) {
  const styles = useStyles2(getStyles);

  if (maxRepositories <= 0 && maxResourcesPerRepository <= 0) {
    return null;
  }

  return (
    <Stack direction="row" alignItems="flex-start">
      <Icon name="exclamation-triangle" className={styles.warningIcon} size="sm" />
      <Text variant="bodySmall">
        <Trans i18nKey="provisioning.quota-limit.note">Note:</Trans>{' '}
        <QuotaLimitMessage maxRepositories={maxRepositories} maxResourcesPerRepository={maxResourcesPerRepository} />
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
  };
};

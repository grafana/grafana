import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Icon, Stack, Text, useStyles2 } from '@grafana/ui';

import { CONFIGURE_GRAFANA_DOCS_URL } from '../constants';

export interface QuotaLimitNoteProps {
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
        {getQuotaDescription(maxRepositories, maxResourcesPerRepository)}
        <a href={CONFIGURE_GRAFANA_DOCS_URL} target="_blank" rel="noopener noreferrer" className={styles.link}>
          <Trans i18nKey="provisioning.quota-limit.upgrade-link">upgrade your account</Trans>{' '}
          <Icon name="external-link-alt" size="xs" />
        </a>
      </Text>
    </Stack>
  );
}

function getQuotaDescription(maxRepositories: number, maxResourcesPerRepository: number) {
  const hasRepoLimit = maxRepositories > 0;
  const hasResourceLimit = maxResourcesPerRepository > 0;

  if (hasRepoLimit && hasResourceLimit) {
    return (
      <>
        <Trans i18nKey="provisioning.quota-limit.note-message-both-repositories" count={maxRepositories}>
          Your account is limited to {{ count: maxRepositories }} connected repositories
        </Trans>{' '}
        <Trans i18nKey="provisioning.quota-limit.note-message-both-resources" count={maxResourcesPerRepository}>
          and {{ count: maxResourcesPerRepository }} synced resources per repository. To increase limits,
        </Trans>
      </>
    );
  }

  if (hasResourceLimit) {
    return (
      <Trans i18nKey="provisioning.quota-limit.note-message-resource" count={maxResourcesPerRepository}>
        Your account is limited to {{ count: maxResourcesPerRepository }} synced resources per repository. To add more
        resources,
      </Trans>
    );
  }

  return (
    <Trans i18nKey="provisioning.quota-limit.note-message-repository" count={maxRepositories}>
      Your account is limited to {{ count: maxRepositories }} connected repositories. To add more repositories,
    </Trans>
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

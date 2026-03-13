import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Icon, Stack, Text, useStyles2 } from '@grafana/ui';

import { CONFIGURE_GRAFANA_DOCS_URL, UPGRADE_URL } from '../constants';
import { isOnPrem } from '../utils/isOnPrem';

export interface QuotaLimitNoteProps {
  maxRepositories?: number;
  maxResourcesPerRepository?: number;
}

export function QuotaLimitNote({ maxRepositories = 0, maxResourcesPerRepository = 0 }: QuotaLimitNoteProps) {
  const styles = useStyles2(getStyles);
  const onPrem = isOnPrem();

  const hasRepoLimit = maxRepositories > 0;
  const hasResourceLimit = maxResourcesPerRepository > 0;

  if (!hasRepoLimit && !hasResourceLimit) {
    return null;
  }

  return (
    <Stack direction="row" alignItems="flex-start">
      <Icon name="exclamation-triangle" className={styles.warningIcon} size="sm" />
      <Text variant="bodySmall">
        <Trans i18nKey="provisioning.quota-limit.note">Note:</Trans>{' '}
        <LimitMessage
          onPrem={onPrem}
          hasRepoLimit={hasRepoLimit}
          hasResourceLimit={hasResourceLimit}
          maxRepositories={maxRepositories}
          maxResourcesPerRepository={maxResourcesPerRepository}
        />
        <ActionLink onPrem={onPrem} className={styles.link} />
      </Text>
    </Stack>
  );
}

interface LimitMessageProps {
  onPrem: boolean;
  hasRepoLimit: boolean;
  hasResourceLimit: boolean;
  maxRepositories: number;
  maxResourcesPerRepository: number;
}

function LimitMessage({
  onPrem,
  hasRepoLimit,
  hasResourceLimit,
  maxRepositories,
  maxResourcesPerRepository,
}: LimitMessageProps) {
  if (hasRepoLimit && hasResourceLimit) {
    return (
      <BothLimitsMessage
        onPrem={onPrem}
        maxRepositories={maxRepositories}
        maxResourcesPerRepository={maxResourcesPerRepository}
      />
    );
  }

  if (hasResourceLimit) {
    return onPrem ? (
      <Trans i18nKey="provisioning.quota-limit.note-message-resource-onprem" count={maxResourcesPerRepository}>
        Your instance is limited to {{ count: maxResourcesPerRepository }} synced resources per repository. To add more
        resources,
      </Trans>
    ) : (
      <Trans i18nKey="provisioning.quota-limit.note-message-resource" count={maxResourcesPerRepository}>
        Your account is limited to {{ count: maxResourcesPerRepository }} synced resources per repository. To add more
        resources,
      </Trans>
    );
  }

  return onPrem ? (
    <Trans i18nKey="provisioning.quota-limit.note-message-repository-onprem" count={maxRepositories}>
      Your instance is limited to {{ count: maxRepositories }} connected repositories. To add more repositories,
    </Trans>
  ) : (
    <Trans i18nKey="provisioning.quota-limit.note-message-repository" count={maxRepositories}>
      Your account is limited to {{ count: maxRepositories }} connected repositories. To add more repositories,
    </Trans>
  );
}

function BothLimitsMessage({
  onPrem,
  maxRepositories,
  maxResourcesPerRepository,
}: {
  onPrem: boolean;
  maxRepositories: number;
  maxResourcesPerRepository: number;
}) {
  if (onPrem) {
    return (
      <>
        <Trans i18nKey="provisioning.quota-limit.note-message-both-repositories-onprem" count={maxRepositories}>
          Your instance is limited to {{ count: maxRepositories }} connected repositories
        </Trans>{' '}
        <Trans i18nKey="provisioning.quota-limit.note-message-both-resources-onprem" count={maxResourcesPerRepository}>
          and {{ count: maxResourcesPerRepository }} synced resources per repository. To increase limits,
        </Trans>
      </>
    );
  }

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

function ActionLink({ onPrem, className }: { onPrem: boolean; className: string }) {
  if (onPrem) {
    return (
      <a href={CONFIGURE_GRAFANA_DOCS_URL} target="_blank" rel="noopener noreferrer" className={className}>
        <Trans i18nKey="provisioning.quota-limit.update-configuration-link">update your Grafana configuration</Trans>{' '}
        <Icon name="external-link-alt" size="xs" />
      </a>
    );
  }

  return (
    <a href={UPGRADE_URL} target="_blank" rel="noopener noreferrer" className={className}>
      <Trans i18nKey="provisioning.quota-limit.upgrade-link">upgrade your account</Trans>{' '}
      <Icon name="external-link-alt" size="xs" />
    </a>
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

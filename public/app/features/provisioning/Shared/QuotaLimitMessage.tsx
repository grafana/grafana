import { Trans } from '@grafana/i18n';
import { TextLink } from '@grafana/ui';

import { CONFIGURE_GRAFANA_DOCS_URL, UPGRADE_URL } from '../constants';
import { isOnPrem } from '../utils/isOnPrem';

interface QuotaLimitMessageProps {
  maxRepositories?: number;
  maxResourcesPerRepository?: number;
  showActionLink?: boolean;
}

export function QuotaLimitMessage({
  maxRepositories = 0,
  maxResourcesPerRepository = 0,
  showActionLink = true,
}: QuotaLimitMessageProps) {
  const onPrem = isOnPrem();
  const hasRepoLimit = maxRepositories > 0;
  const hasResourceLimit = maxResourcesPerRepository > 0;

  if (!hasRepoLimit && !hasResourceLimit) {
    return null;
  }

  const url = onPrem ? CONFIGURE_GRAFANA_DOCS_URL : UPGRADE_URL;
  const limitType = hasRepoLimit && hasResourceLimit ? 'limits' : hasResourceLimit ? 'resources' : 'repositories';

  return (
    <>
      <LimitText
        onPrem={onPrem}
        hasRepoLimit={hasRepoLimit}
        hasResourceLimit={hasResourceLimit}
        maxRepositories={maxRepositories}
        maxResourcesPerRepository={maxResourcesPerRepository}
      />
      {showActionLink && (
        <>
          {' '}
          <Trans i18nKey="provisioning.quota-limit.to-increase-limits" values={{ type: limitType }}>
            To add more {{ type: limitType }},
          </Trans>{' '}
          <TextLink href={url} external variant="bodySmall">
            {onPrem ? (
              <Trans i18nKey="provisioning.quota-limit.update-configuration-link">
                update your Grafana configuration
              </Trans>
            ) : (
              <Trans i18nKey="provisioning.quota-limit.upgrade-link">upgrade your account</Trans>
            )}
          </TextLink>
        </>
      )}
    </>
  );
}

function LimitText({
  onPrem,
  hasRepoLimit,
  hasResourceLimit,
  maxRepositories,
  maxResourcesPerRepository,
}: {
  onPrem: boolean;
  hasRepoLimit: boolean;
  hasResourceLimit: boolean;
  maxRepositories: number;
  maxResourcesPerRepository: number;
}) {
  switch (getLimitKind(hasRepoLimit, hasResourceLimit)) {
    case 'both':
      return onPrem ? (
        <>
          <Trans i18nKey="provisioning.quota-limit.message-both-repositories-onprem" count={maxRepositories}>
            Your instance is limited to {{ count: maxRepositories }} connected repositories
          </Trans>{' '}
          <Trans i18nKey="provisioning.quota-limit.message-both-resources-onprem" count={maxResourcesPerRepository}>
            and {{ count: maxResourcesPerRepository }} synced resources per repository.
          </Trans>
        </>
      ) : (
        <>
          <Trans i18nKey="provisioning.quota-limit.message-both-repositories" count={maxRepositories}>
            Your account is limited to {{ count: maxRepositories }} connected repositories
          </Trans>{' '}
          <Trans i18nKey="provisioning.quota-limit.message-both-resources" count={maxResourcesPerRepository}>
            and {{ count: maxResourcesPerRepository }} synced resources per repository.
          </Trans>
        </>
      );

    case 'resource':
      return onPrem ? (
        <Trans i18nKey="provisioning.quota-limit.message-resource-onprem" count={maxResourcesPerRepository}>
          Your instance is limited to {{ count: maxResourcesPerRepository }} synced resources per repository.
        </Trans>
      ) : (
        <Trans i18nKey="provisioning.quota-limit.message-resource" count={maxResourcesPerRepository}>
          Your account is limited to {{ count: maxResourcesPerRepository }} synced resources per repository.
        </Trans>
      );

    case 'repository':
      return onPrem ? (
        <Trans i18nKey="provisioning.quota-limit.message-repository-onprem" count={maxRepositories}>
          Your instance is limited to {{ count: maxRepositories }} connected repositories.
        </Trans>
      ) : (
        <Trans i18nKey="provisioning.quota-limit.message-repository" count={maxRepositories}>
          Your account is limited to {{ count: maxRepositories }} connected repositories.
        </Trans>
      );
  }
}

type LimitKind = 'both' | 'resource' | 'repository';

function getLimitKind(hasRepoLimit: boolean, hasResourceLimit: boolean): LimitKind {
  if (hasRepoLimit && hasResourceLimit) {
    return 'both';
  }
  return hasResourceLimit ? 'resource' : 'repository';
}

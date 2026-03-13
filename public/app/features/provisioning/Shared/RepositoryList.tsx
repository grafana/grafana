import { useState } from 'react';

import { t, Trans } from '@grafana/i18n';
import { Alert, Box, EmptyState, FilterInput, Icon, Stack, TextLink } from '@grafana/ui';
import { Repository, useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1';

import { RepositoryListItem } from '../Repository/RepositoryListItem';
import { useResourceStats } from '../Wizard/hooks/useResourceStats';
import { CONFIGURE_GRAFANA_DOCS_URL, UPGRADE_URL } from '../constants';
import { useIsProvisionedInstance } from '../hooks/useIsProvisionedInstance';
import { checkSyncSettings } from '../utils/checkSyncSettings';
import { isOnPrem } from '../utils/isOnPrem';

interface Props {
  items: Repository[];
}

export function RepositoryList({ items }: Props) {
  const [query, setQuery] = useState('');
  const isProvisionedInstance = useIsProvisionedInstance();
  const { resourceCount, managedCount, unmanagedCount } = useResourceStats(items[0]?.metadata?.name);
  const { data: frontendSettings } = useGetFrontendSettingsQuery();
  const maxRepositories = frontendSettings?.maxRepositories;
  const maxResourcesPerRepository = items[0]?.status?.quota?.maxResourcesPerRepository;
  const isRepoLimitHit = !!maxRepositories && items.length >= maxRepositories;
  const filteredItems = items.filter((item) => item.metadata?.name?.includes(query));
  const isEmpty = items.length === 0;
  if (isEmpty) {
    return (
      <EmptyState
        variant="not-found"
        message={t('provisioning.repository-list.no-repositories', 'No repositories configured')}
      />
    );
  }
  const { instanceConnected } = checkSyncSettings(items);
  const hasInstanceSyncRepo = items.some((item) => item.spec?.sync?.target === 'instance');

  const getResourceCountSection = () => {
    if (isProvisionedInstance) {
      return (
        <Box marginBottom={2}>
          <Stack alignItems="center">
            <Icon name="check" color="green" />
            <Trans i18nKey="provisioning.folder-repository-list.all-resources-managed" count={resourceCount}>
              All {{ count: resourceCount }} resources are managed
            </Trans>
          </Stack>
        </Box>
      );
    }

    if (filteredItems.length) {
      return (
        <Stack>
          <Alert title={''} severity="info">
            <Trans
              i18nKey="provisioning.folder-repository-list.partial-managed"
              values={{ managedCount, resourceCount }}
            >
              {{ managedCount }}/{{ resourceCount }} resources managed by Git sync.
            </Trans>
            {unmanagedCount > 0 && (
              <>
                {' '}
                <Trans i18nKey="provisioning.folder-repository-list.unmanaged-resources" count={unmanagedCount}>
                  {{ count: unmanagedCount }} resources aren&apos;t managed by Git sync.
                </Trans>
              </>
            )}
            {isRepoLimitHit && (
              <RepoLimitMessage
                maxRepositories={maxRepositories}
                maxResourcesPerRepository={maxResourcesPerRepository}
              />
            )}
          </Alert>
        </Stack>
      );
    }
    return null;
  };

  return (
    <>
      {getResourceCountSection()}
      {hasInstanceSyncRepo && (
        <Alert
          title={t('provisioning.instance-sync-deprecation.title', 'Instance sync is not fully supported')}
          severity="warning"
        >
          <Trans i18nKey="provisioning.instance-sync-deprecation.message">
            Instance sync is currently not fully supported and breaks library panels and alerts. To use library panels
            and alerts, disconnect your repository and reconnect it using folder sync instead.
          </Trans>
        </Alert>
      )}
      <Stack direction={'column'} gap={3}>
        {!instanceConnected && (
          <Stack gap={2}>
            <FilterInput
              placeholder={t('provisioning.folder-repository-list.placeholder-search', 'Search')}
              value={query}
              onChange={setQuery}
            />
          </Stack>
        )}
        <Stack direction={'column'} gap={2}>
          {filteredItems.length ? (
            filteredItems.map((item) => <RepositoryListItem key={item.metadata?.name} repository={item} />)
          ) : (
            <EmptyState
              variant="not-found"
              message={t(
                'provisioning.folder-repository-list.no-results-matching-your-query',
                'No results matching your query'
              )}
            />
          )}
        </Stack>
      </Stack>
    </>
  );
}

function RepoLimitMessage({
  maxRepositories,
  maxResourcesPerRepository,
}: {
  maxRepositories: number;
  maxResourcesPerRepository?: number;
}) {
  const onPrem = isOnPrem();

  return (
    <>
      {' '}
      <RepoLimitText
        onPrem={onPrem}
        maxRepositories={maxRepositories}
        maxResourcesPerRepository={maxResourcesPerRepository}
      />{' '}
      {onPrem ? (
        <TextLink href={CONFIGURE_GRAFANA_DOCS_URL} external>
          <Trans i18nKey="provisioning.quota-limit.update-configuration-link">update your Grafana configuration</Trans>
        </TextLink>
      ) : (
        <TextLink href={UPGRADE_URL} external>
          <Trans i18nKey="provisioning.quota-limit.upgrade-link">upgrade your account</Trans>
        </TextLink>
      )}
    </>
  );
}

function RepoLimitText({
  onPrem,
  maxRepositories,
  maxResourcesPerRepository,
}: {
  onPrem: boolean;
  maxRepositories: number;
  maxResourcesPerRepository?: number;
}) {
  if (maxResourcesPerRepository) {
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
  }

  return onPrem ? (
    <Trans i18nKey="provisioning.quota-limit.message-repository-onprem" count={maxRepositories}>
      Your instance is limited to {{ count: maxRepositories }} connected repositories. To add more repositories,
    </Trans>
  ) : (
    <Trans i18nKey="provisioning.quota-limit.message-repository" count={maxRepositories}>
      Your account is limited to {{ count: maxRepositories }} connected repositories. To add more repositories,
    </Trans>
  );
}

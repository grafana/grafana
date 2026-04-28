import { useState } from 'react';

import { t, Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Alert, Box, EmptyState, FilterInput, Icon, LinkButton, Stack } from '@grafana/ui';
import { type Repository, useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1';

import { RepositoryListItem } from '../Repository/RepositoryListItem';
import { useResourceStats } from '../Wizard/hooks/useResourceStats';
import { STATS_TAB_URL } from '../constants';
import { useIsProvisionedInstance } from '../hooks/useIsProvisionedInstance';
import { checkSyncSettings } from '../utils/checkSyncSettings';

import { QuotaLimitMessage } from './QuotaLimitMessage';

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
          <Alert
            title={''}
            severity="info"
            action={
              config.featureToggles.provisioningExport ? (
                <LinkButton variant="secondary" fill="outline" size="sm" href={STATS_TAB_URL} icon="chart-line">
                  <Trans i18nKey="provisioning.folder-repository-list.see-details">See details</Trans>
                </LinkButton>
              ) : undefined
            }
          >
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
              <>
                {' '}
                <QuotaLimitMessage
                  maxRepositories={maxRepositories}
                  maxResourcesPerRepository={maxResourcesPerRepository}
                />
              </>
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

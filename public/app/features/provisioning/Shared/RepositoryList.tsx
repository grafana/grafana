import { useState } from 'react';

import { t, Trans } from '@grafana/i18n';
import { Alert, Box, EmptyState, FilterInput, Icon, Stack, TextLink } from '@grafana/ui';
import { Repository } from 'app/api/clients/provisioning/v0alpha1';

import { RepositoryCard } from '../Repository/RepositoryCard';
import { useResourceStats } from '../Wizard/hooks/useResourceStats';
import { UPGRADE_URL } from '../constants';
import { useIsProvisionedInstance } from '../hooks/useIsProvisionedInstance';
import { checkSyncSettings } from '../utils/checkSyncSettings';
import { isFreeTierLicense } from '../utils/isFreeTierLicense';

interface Props {
  items: Repository[];
}

export function RepositoryList({ items }: Props) {
  const [query, setQuery] = useState('');
  const isProvisionedInstance = useIsProvisionedInstance();
  const { resourceCount, managedCount, unmanagedCount } = useResourceStats(items[0].metadata?.name);

  const filteredItems = items.filter((item) => item.metadata?.name?.includes(query));
  const { instanceConnected } = checkSyncSettings(items);

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
            {isFreeTierLicense() && (
              <>
                <br />
                <Trans i18nKey="provisioning.free-tier-limit.message-connection">
                  Free-tier accounts are limited to 20 resources per folder. To add more resources per folder,
                </Trans>{' '}
                <TextLink href={UPGRADE_URL} external>
                  <Trans i18nKey="provisioning.free-tier-limit.upgrade-link">upgrade your account</Trans>{' '}
                </TextLink>
                .
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
            filteredItems.map((item) => <RepositoryCard key={item.metadata?.name} repository={item} />)
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

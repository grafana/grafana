import { useState } from 'react';

import { t, Trans } from '@grafana/i18n';
import { EmptyState, FilterInput, Icon, Stack } from '@grafana/ui';
import { Repository } from 'app/api/clients/provisioning/v0alpha1';

import { RepositoryCard } from '../Repository/RepositoryCard';
import { useResourceStats } from '../Wizard/hooks/useResourceStats';
import { useIsProvisionedInstance } from '../hooks/useIsProvisionedInstance';
import { checkSyncSettings } from '../utils/checkSyncSettings';

interface Props {
  items: Repository[];
}

export function RepositoryList({ items }: Props) {
  const [query, setQuery] = useState('');
  const isProvisionedInstance = useIsProvisionedInstance();
  const { resourceCount } = useResourceStats(isProvisionedInstance ? items[0]?.metadata?.name : undefined);

  const filteredItems = items.filter((item) => item.metadata?.name?.includes(query));
  const { instanceConnected } = checkSyncSettings(items);

  return (
    <Stack direction={'column'} gap={3}>
      {isProvisionedInstance && (
        <Stack alignItems="center">
          <Icon name="check" color="green" />
          <Trans i18nKey="provisioning.folder-repository-list.all-resources-managed" count={resourceCount}>
            All {{ count: resourceCount }} resources are managed
          </Trans>
        </Stack>
      )}
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
  );
}

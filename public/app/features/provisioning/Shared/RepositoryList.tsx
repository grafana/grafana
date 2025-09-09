import { useState } from 'react';

import { t } from '@grafana/i18n';
import { EmptyState, FilterInput, Stack } from '@grafana/ui';
import { Repository } from 'app/api/clients/provisioning/v0alpha1';

import { RepositoryCard } from '../Repository/RepositoryCard';
import { checkSyncSettings } from '../utils/checkSyncSettings';

interface Props {
  items: Repository[];
}

export function RepositoryList({ items }: Props) {
  const [query, setQuery] = useState('');

  const filteredItems = items.filter((item) => item.metadata?.name?.includes(query));
  const { instanceConnected } = checkSyncSettings(items);
  return (
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
  );
}

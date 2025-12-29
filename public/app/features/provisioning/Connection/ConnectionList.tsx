import { useState } from 'react';

import { t } from '@grafana/i18n';
import { EmptyState, FilterInput, Stack } from '@grafana/ui';
import { Connection } from 'app/api/clients/provisioning/v0alpha1';

import { ConnectionListItem } from './ConnectionListItem';

interface Props {
  items: Connection[];
}

export function ConnectionList({ items }: Props) {
  const [query, setQuery] = useState('');

  const filteredItems = items.filter((item) => {
    if (!query) {
      return true;
    }
    const lowerQuery = query.toLowerCase();
    const name = item.metadata?.name?.toLowerCase() ?? '';
    const providerType = item.spec?.type?.toLowerCase() ?? '';
    return name.includes(lowerQuery) || providerType.includes(lowerQuery);
  });

  return (
    <Stack direction={'column'} gap={3}>
      <FilterInput
        placeholder={t('provisioning.connections.search-placeholder', 'Search connections')}
        value={query}
        onChange={setQuery}
      />
      <Stack direction={'column'} gap={2}>
        {filteredItems.length ? (
          filteredItems.map((item) => <ConnectionListItem key={item.metadata?.name} connection={item} />)
        ) : (
          <EmptyState
            variant="not-found"
            message={t('provisioning.connections.no-results', 'No results matching your query')}
          />
        )}
      </Stack>
    </Stack>
  );
}

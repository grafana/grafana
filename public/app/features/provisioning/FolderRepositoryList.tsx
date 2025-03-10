import { useState } from 'react';

import { EmptySearchResult, FilterInput, LinkButton, Stack } from '@grafana/ui';

import { RepositoryCard } from './RepositoryCard';
import { Repository, useGetFrontendSettingsQuery } from './api';
import { CONNECT_URL } from './constants';
import { checkSyncSettings } from './utils';

export function FolderRepositoryList({ items }: { items: Repository[] }) {
  const [query, setQuery] = useState('');
  const filteredItems = items.filter((item) => item.metadata?.name?.includes(query));
  const settings = useGetFrontendSettingsQuery();
  const [instanceConnected] = checkSyncSettings(settings.data);

  return (
    <Stack direction={'column'} gap={3}>
      <Stack gap={2}>
        <FilterInput placeholder="Search" value={query} onChange={setQuery} />
        {!instanceConnected && (
          <LinkButton href={CONNECT_URL} variant="primary" icon={'plus'}>
            Connect to repository
          </LinkButton>
        )}
      </Stack>
      <Stack direction={'column'}>
        {!!filteredItems.length ? (
          filteredItems.map((item) => <RepositoryCard key={item.metadata?.name} repository={item} />)
        ) : (
          <EmptySearchResult>No results matching your query </EmptySearchResult>
        )}
      </Stack>
    </Stack>
  );
}

import { useState } from 'react';

import { EmptySearchResult, FilterInput, Stack } from '@grafana/ui';
import { Repository, RepositoryViewList } from 'app/api/clients/provisioning';

import { RepositoryCard } from '../Repository/RepositoryCard';

import { ConnectRepositoryButton } from './ConnectRepositoryButton';

interface Props {
  items: Repository[];
  settings?: RepositoryViewList;
}

export function FolderRepositoryList({ items, settings }: Props) {
  const [query, setQuery] = useState('');
  const filteredItems = items.filter((item) => item.metadata?.name?.includes(query));

  return (
    <Stack direction={'column'} gap={3}>
      <Stack gap={2}>
        <FilterInput placeholder="Search" value={query} onChange={setQuery} />
        <ConnectRepositoryButton settings={settings} />
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

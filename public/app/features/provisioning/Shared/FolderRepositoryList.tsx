import { useState } from 'react';

import { EmptySearchResult, FilterInput, Stack } from '@grafana/ui';
import { Repository } from 'app/api/clients/provisioning';

import { RepositoryCard } from '../Repository/RepositoryCard';

import { ConnectRepositoryButton } from './ConnectRepositoryButton';

interface Props {
  items: Repository[];
}

export function FolderRepositoryList({ items }: Props) {
  const [query, setQuery] = useState('');
  const filteredItems = items.filter((item) => item.metadata?.name?.includes(query));

  return (
    <Stack direction={'column'} gap={3}>
      <Stack gap={2}>
        <FilterInput placeholder="Search" value={query} onChange={setQuery} />
        <ConnectRepositoryButton items={items} />
      </Stack>
      <Stack direction={'column'}>
        {filteredItems.length ? (
          filteredItems.map((item) => <RepositoryCard key={item.metadata?.name} repository={item} />)
        ) : (
          <EmptySearchResult>No results matching your query </EmptySearchResult>
        )}
      </Stack>
    </Stack>
  );
}

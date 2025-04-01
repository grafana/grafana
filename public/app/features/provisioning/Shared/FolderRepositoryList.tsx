import { useState } from 'react';

import { EmptySearchResult, FilterInput, Stack } from '@grafana/ui';
import { Repository } from 'app/api/clients/provisioning';
import { t, Trans } from 'app/core/internationalization';

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
        <FilterInput
          placeholder={t('provisioning.folder-repository-list.placeholder-search', 'Search')}
          value={query}
          onChange={setQuery}
        />
        <ConnectRepositoryButton items={items} />
      </Stack>
      <Stack direction={'column'}>
        {filteredItems.length ? (
          filteredItems.map((item) => <RepositoryCard key={item.metadata?.name} repository={item} />)
        ) : (
          <EmptySearchResult>
            <Trans i18nKey="provisioning.folder-repository-list.no-results-matching-your-query">
              No results matching your query
            </Trans>
          </EmptySearchResult>
        )}
      </Stack>
    </Stack>
  );
}

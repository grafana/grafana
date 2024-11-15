import { css } from '@emotion/css';
import { useState } from 'react';

import { Card, EmptySearchResult, EmptyState, FilterInput, LinkButton, Stack } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { Resource } from '../apiserver/types';

import { useListRepositoryQuery } from './api';
import { RepositorySpec } from './api/types';
import { NEW_URL } from './constants';

export default function RepositoryListPage() {
  const query = useListRepositoryQuery();
  return (
    <Page navId="provisioning" subTitle="View and manage your configured repositories">
      <Page.Contents isLoading={query.isLoading}>
        <RepositoryListPageContent items={query.data?.items} />
      </Page.Contents>
    </Page>
  );
}

function RepositoryListPageContent({ items }: { items?: Array<Resource<RepositorySpec>> }) {
  const [query, setQuery] = useState('');
  if (!items?.length) {
    return (
      <EmptyState
        variant="call-to-action"
        message="You haven't created any repository configs yet"
        button={
          <LinkButton icon="plus" href={NEW_URL} size="lg">
            Create repository config
          </LinkButton>
        }
      />
    );
  }

  const filteredItems = items.filter((item) => item.metadata.name.includes(query));

  return (
    <Stack direction={'column'} gap={3}>
      <Stack gap={2}>
        <FilterInput placeholder="Search by name" autoFocus={true} value={query} onChange={setQuery} />
        <LinkButton href={NEW_URL} variant="primary" icon={'plus'}>
          Add repository config
        </LinkButton>
      </Stack>
      <Stack direction={'column'}>
        {!!filteredItems.length ? (
          filteredItems.map((item) => {
            return (
              <Card key={item.metadata.name} className={css({ alignItems: 'center' })}>
                <Stack direction={'column'}>
                  <Card.Heading>{item.metadata.name}</Card.Heading>
                  <Card.Meta>{item.spec.type}</Card.Meta>
                </Stack>
                <Stack>
                  <LinkButton variant="secondary" href={`/provisioning/edit/${item.metadata.name}`}>
                    Edit
                  </LinkButton>
                  <LinkButton variant="destructive" href={`/provisioning/delete/${item.metadata.name}`}>
                    Delete
                  </LinkButton>
                </Stack>
              </Card>
            );
          })
        ) : (
          <EmptySearchResult>No results matching your query</EmptySearchResult>
        )}
      </Stack>
    </Stack>
  );
}

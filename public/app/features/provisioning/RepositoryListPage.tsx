import { css } from '@emotion/css';
import { useState } from 'react';

import { Card, EmptySearchResult, EmptyState, FilterInput, LinkButton, Stack, TextLink } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { Resource } from '../apiserver/types';

import { DeleteRepositoryButton } from './DeleteRepositoryButton';
import { RepositorySpec } from './api/types';
import { NEW_URL, PROVISIONING_URL } from './constants';
import { useRepositoryList } from './hooks';

export default function RepositoryListPage() {
  const [items, isLoading] = useRepositoryList();
  return (
    <Page navId="provisioning" subTitle="View and manage your configured repositories">
      <Page.Contents isLoading={isLoading}>
        <RepositoryListPageContent items={items} />
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
        <FilterInput placeholder="Search" value={query} onChange={setQuery} />
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
                  <Card.Heading>
                    <TextLink href={`${PROVISIONING_URL}/${item.metadata.name}`}>{item.spec.title}</TextLink>
                  </Card.Heading>
                  <Card.Meta>{item.spec.type}</Card.Meta>
                </Stack>
                <Stack>
                  <LinkButton variant="secondary" href={`${PROVISIONING_URL}/${item.metadata.name}/edit`}>
                    Edit
                  </LinkButton>
                  <DeleteRepositoryButton name={item.metadata.name} />
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

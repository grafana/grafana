import { css } from '@emotion/css';
import { useState } from 'react';

import { Alert, Card, EmptySearchResult, EmptyState, FilterInput, LinkButton, Stack, TextLink } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { DeleteRepositoryButton } from './DeleteRepositoryButton';
import { SyncRepository } from './SyncRepository';
import { Repository } from './api';
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

function RepositoryListPageContent({ items }: { items?: Repository[] }) {
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

  const filteredItems = items.filter((item) => item.metadata?.name?.includes(query));

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
            const name = item.metadata?.name ?? '';
            const healthy = Boolean(item.status?.health.healthy)
            return (
              <Card key={item.metadata?.name} className={css({ alignItems: 'center' })}>
                <Stack direction={'column'}>
                  <Card.Heading>
                    <TextLink href={`${PROVISIONING_URL}/${name}`}>{item.spec?.title}</TextLink>
                  </Card.Heading>
                  <Card.Meta>{item.spec?.type}</Card.Meta>
                </Stack>
                <Stack>
                  {healthy ? <>
                    <LinkButton variant="secondary" href={`${PROVISIONING_URL}/${name}/edit`}>
                      Edit
                    </LinkButton>
                    <SyncRepository repository={item} />
                    <DeleteRepositoryButton name={name} />
                  </> : <>
                    <Alert title='Repository is unhealthy'>
                      <>
                        {item.status?.health.message && item.status.health.message.map(v => <div>{v}<br/><br/></div>)}
                        <div>
                          <LinkButton variant="secondary" href={`${PROVISIONING_URL}/${name}/edit`}>
                            Edit
                          </LinkButton>
                          <DeleteRepositoryButton name={name} />
                        </div>
                      </>
                    </Alert>
                  </>}
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

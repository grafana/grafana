import { ReactNode, useState } from 'react';

import {
  Alert,
  Card,
  EmptySearchResult,
  EmptyState,
  FilterInput,
  Icon,
  IconName,
  LinkButton,
  Stack,
} from '@grafana/ui';
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
            const healthy = Boolean(item.status?.health.healthy);
            let icon: IconName = 'database'; // based on type
            let meta: ReactNode[] = [
              // TODO... add counts? and sync info
            ];
            switch (item.spec?.type) {
              case 'github':
                icon = 'github';
                const spec = item.spec.github;
                let url = `https://github.com/${spec?.owner}/${spec?.repository}/`;
                if (spec?.branch) {
                  url += `tree/` + spec?.branch;
                }
                meta.push(<a href={url}>{url}</a>);
                break;

              case 'local':
                meta.push(item.spec.local?.path);
                break;
            }
            return (
              <Card key={item.metadata?.name}>
                <Card.Figure>
                  <Icon name={icon} width={40} height={40} />
                </Card.Figure>
                <Card.Heading>{item.spec?.title}</Card.Heading>
                <Card.Description>
                  {item.spec?.description}

                  {item.status ? (
                    <>
                      {!healthy && (
                        <Alert
                          title="Repository is unhealthy"
                          children={item.status?.health?.message?.map((v) => (
                            <div>
                              {v}
                              <br />
                              <br />
                            </div>
                          ))}
                        ></Alert>
                      )}
                    </>
                  ) : (
                    <div>
                      <Alert severity="warning" title="repository initializing" />
                    </div>
                  )}
                </Card.Description>
                <Card.Meta>{meta}</Card.Meta>
                <Card.Actions>
                  <LinkButton href={`${PROVISIONING_URL}/${name}`} variant="secondary">
                    Manage
                  </LinkButton>
                  {item.spec?.folder && (
                    <LinkButton href={`/dashboards/f/${item.spec?.folder}/`} variant="secondary">
                      View
                    </LinkButton>
                  )}
                  {healthy && <SyncRepository repository={item} />}
                </Card.Actions>
                <Card.SecondaryActions>
                  {/* <IconButton key="comment-alt" name="comment-alt" tooltip="Tooltip content" />
                  <IconButton key="copy" name="copy" tooltip="Tooltip content" /> */}
                  <DeleteRepositoryButton name={name} />
                </Card.SecondaryActions>
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

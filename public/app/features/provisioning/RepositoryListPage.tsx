import { ReactNode, useMemo, useState } from 'react';
import { useObservable } from 'react-use';

import { locationService } from '@grafana/runtime';
import {
  Badge,
  BadgeColor,
  Card,
  EmptySearchResult,
  EmptyState,
  FilterInput,
  Icon,
  IconName,
  LinkButton,
  Stack,
  TextLink,
} from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { ScopedResourceClient } from '../apiserver/client';

import { DeleteRepositoryButton } from './DeleteRepositoryButton';
import { SyncRepository } from './SyncRepository';
import { Repository, RepositorySpec } from './api';
import { RepositoryStatus } from './api/types';
import { NEW_URL, PROVISIONING_URL } from './constants';
import { useRepositoryList } from './hooks';

const client = new ScopedResourceClient<RepositorySpec, RepositoryStatus>({
  group: 'provisioning.grafana.app',
  version: 'v0alpha1',
  resource: 'repositories',
});

export default function RepositoryListPage() {
  const obs = useMemo(() => client.watch(), [])
  const xxx = useObservable(obs)
  console.log( 'event', {xxx})

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
                const url = `https://github.com/${spec?.owner}/${spec?.repository}/`;
                let branch = url;
                if (spec?.branch) {
                  branch += `tree/` + spec?.branch;
                }
                meta.push(
                  <TextLink key={'link'} external style={{ color: 'inherit' }} href={branch}>
                    {branch}
                  </TextLink>
                );

                if (item.status?.webhook?.id) {
                  const hook = url + `/settings/hooks/${item.status?.webhook?.id}`;
                  meta.push(
                    <TextLink key={'webhook'} style={{ color: 'inherit' }} href={hook}>
                      Webhook <Icon name={'check'} />
                    </TextLink>
                  );
                }

                break;

              case 'local':
                meta.push(<span key={'path'}>{item.spec.local?.path}</span>);
                break;
            }

            return (
              <Card key={name}>
                <Card.Figure>
                  <Icon name={icon} width={40} height={40} />
                </Card.Figure>
                <Card.Heading>
                  <Stack>
                    {item.spec?.title} <StatusBadge repo={item} />
                  </Stack>
                </Card.Heading>
                <Card.Description>{item.spec?.description}</Card.Description>
                <Card.Meta>{meta}</Card.Meta>
                <Card.Actions>
                  <LinkButton href={`${PROVISIONING_URL}/${name}`} variant="secondary">
                    Manage
                  </LinkButton>
                  <LinkButton href={`${PROVISIONING_URL}/${name}/edit`} variant="secondary">
                    Edit
                  </LinkButton>
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

function StatusBadge({ repo }: { repo: Repository }) {
  const state = repo.status?.sync?.state;

  if (!state) {
    return null;
  }

  let color: BadgeColor = 'green';
  let text = 'Synced';
  let icon: IconName = 'check';
  switch (state) {
    case 'working':
    case 'pending':
      color = 'orange';
      text = 'Syncing';
      icon = 'spinner';
      break;
    case 'error':
      color = 'red';
      text = 'Error';
      icon = 'exclamation-triangle';
      break;
    default:
      break;
  }
  return (
    <Badge
      color={color}
      icon={icon}
      text={text}
      style={{ cursor: 'pointer' }}
      onClick={() => {
        locationService.push(`${PROVISIONING_URL}/${name}/?tab=health`);
      }}
    />
  );
}

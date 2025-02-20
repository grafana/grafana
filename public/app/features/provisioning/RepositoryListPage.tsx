import { ReactNode, useState } from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';

import {
  Card,
  EmptySearchResult,
  EmptyState,
  FilterInput,
  Icon,
  IconName,
  LinkButton,
  Stack,
  TextLink,
  Text,
  Alert,
} from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { DeleteRepositoryButton } from './DeleteRepositoryButton';
import { SetupWarnings } from './SetupWarnings';
import { StatusBadge } from './StatusBadge';
import { SyncRepository } from './SyncRepository';
import { Repository, ResourceCount, useGetFrontendSettingsQuery } from './api';
import { NEW_URL, PROVISIONING_URL } from './constants';
import { useRepositoryList } from './hooks';

export default function RepositoryListPage() {
  const [items, isLoading] = useRepositoryList({ watch: true });
  const settings = useGetFrontendSettingsQuery();
  const navigate = useNavigate();
  return (
    <Page navId="provisioning" subTitle="View and manage your configured repositories">
      <Page.Contents isLoading={isLoading}>
        <SetupWarnings />
        {settings.data?.legacyStorage && (
          <Alert
            title="Legacy Storage"
            severity="error"
            buttonContent={<>Use provisioning wizard to configure a repository.</>}
            onRemove={() => {
              navigate('/admin/provisioning/setup');
            }}
          >
            Require running the onboarding wizard to convert from legacy to unified
          </Alert>
        )}
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

            let icon: IconName = 'database'; // based on type
            let meta: ReactNode[] = [];
            switch (item.spec?.type) {
              case 'github':
                icon = 'github';
                const spec = item.spec.github;
                const url = item.spec.github?.url ?? '';
                let branch = url;
                if (spec?.branch) {
                  branch += `/tree/` + spec?.branch;
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
                meta.push(
                  <Text element={'p'} key={'path'}>
                    {item.spec.local?.path ?? ''}
                  </Text>
                );
                break;
            }

            return (
              <Card key={name}>
                <Card.Figure>
                  <Icon name={icon} width={40} height={40} />
                </Card.Figure>
                <Card.Heading>
                  <Stack>
                    {item.spec?.title}{' '}
                    <StatusBadge
                      enabled={Boolean(item.spec?.sync?.enabled)}
                      state={item.status?.sync?.state}
                      name={name}
                    />
                  </Stack>
                </Card.Heading>
                <Card.Description>
                  {item.spec?.description}
                  {item.status?.stats?.length && (
                    <Stack>
                      {item.status.stats.map((v, index) => (
                        <LinkButton key={index} fill="outline" size="md" href={getListURL(item, v)}>
                          {v.count} {v.resource}
                        </LinkButton>
                      ))}
                    </Stack>
                  )}
                </Card.Description>
                <Card.Meta>{meta}</Card.Meta>
                <Card.Actions>
                  <LinkButton icon="eye" href={`${PROVISIONING_URL}/${name}`} variant="secondary">
                    View
                  </LinkButton>
                  <SyncRepository repository={item} />
                  <LinkButton variant="secondary" icon="cog" href={`${PROVISIONING_URL}/${name}/edit`}>
                    Settings
                  </LinkButton>
                </Card.Actions>
                <Card.SecondaryActions>
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

// This should return a URL in the UI that will show the selected values
function getListURL(repo: Repository, stats: ResourceCount): string {
  if (stats.resource === 'playlists') {
    return '/playlists';
  }
  if (repo.spec?.sync.target === 'folder') {
    return `/dashboards/f/${repo.metadata?.name}`;
  }
  return '/dashboards';
}

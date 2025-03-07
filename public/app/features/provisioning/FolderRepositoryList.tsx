import { ReactNode, useState } from 'react';

import { FilterInput, LinkButton, IconName, Stack, Text, TextLink, Icon, Card, EmptySearchResult } from '@grafana/ui';

import { DeleteRepositoryButton } from './DeleteRepositoryButton';
import { StatusBadge } from './StatusBadge';
import { SyncRepository } from './SyncRepository';
import { Repository, ResourceCount, useGetFrontendSettingsQuery } from './api';
import { CONNECT_URL, PROVISIONING_URL } from './constants';
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
                <Card.Meta> {meta} </Card.Meta>
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
          <EmptySearchResult>No results matching your query </EmptySearchResult>
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

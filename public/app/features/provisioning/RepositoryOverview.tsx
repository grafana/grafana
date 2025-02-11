import { useMemo } from 'react';

import { Stack, Box, Text, LinkButton, Card, TextLink, InteractiveTable } from '@grafana/ui';
import { CellProps } from '@grafana/ui';

import { CheckRepository } from './CheckRepository';
import { RepositoryHealth } from './RepositoryHealth';
import { StatusBadge } from './StatusBadge';
import { SyncRepository } from './SyncRepository';
import { Repository } from './api';
import { formatTimestamp } from './utils/time';

// Define the type for our stats
interface StatItem {
  resource: string;
  group: string;
  count: number;
}

type StatCell<T extends keyof StatItem = keyof StatItem> = CellProps<StatItem, StatItem[T]>;

export function RepositoryOverview({ repo }: { repo: Repository }) {
  const remoteURL = getRemoteURL(repo);
  const webhookURL = getWebhookURL(repo);
  const status = repo.status;
  const name = repo.metadata?.name ?? '';
  return (
    <Box padding={2}>
      <Stack gap={2}>
        <Card>
          <Card.Heading>Links</Card.Heading>
          <Card.Meta>
            <Stack>
              {remoteURL && (
                <Text>
                  <TextLink external href={remoteURL}>
                    {remoteURL}
                  </TextLink>
                </Text>
              )}

              {webhookURL && (
                <Text>
                  <TextLink external href={webhookURL}>
                    Webhook
                  </TextLink>
                </Text>
              )}
            </Stack>
          </Card.Meta>
          <Card.Actions>
            <LinkButton fill="outline" size="md" href={getFolderURL(repo)}>
              Containing Folder
            </LinkButton>
          </Card.Actions>
        </Card>
        <Card>
          <Card.Heading>Resources</Card.Heading>
          <Card.Description>
            {repo.status?.stats ? (
              <InteractiveTable
                columns={useMemo(
                  () => [
                    {
                      id: 'Resource',
                      header: 'Resource Type',
                      cell: ({ row: { original } }: StatCell<'resource'>) => {
                        return <span>{original.resource}</span>;
                      },
                      size: 'auto',
                    },
                    {
                      id: 'count',
                      header: 'Count',
                      cell: ({ row: { original } }: StatCell<'count'>) => {
                        return <span>{original.count}</span>;
                      },
                      size: 100,
                    },
                  ],
                  []
                )}
                data={repo.status.stats}
                getRowId={(r: StatItem) => `${r.group}-${r.resource}`}
              />
            ) : null}
          </Card.Description>
        </Card>
        <Card>
          <Card.Heading>Health</Card.Heading>
          <Card.Meta>
            <RepositoryHealth repo={repo} />
          </Card.Meta>

          <Card.Actions>
            <CheckRepository repository={repo} />
          </Card.Actions>
        </Card>
        <Card>
          <Card.Heading>
            Sync Status{' '}
            <StatusBadge enabled={Boolean(repo.spec?.sync?.enabled)} state={repo.status?.sync?.state} name={name} />
          </Card.Heading>
          <Card.Description>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '8px', alignItems: 'baseline' }}>
              <Text color="secondary">Job ID:</Text>
              <Text variant="body">{status?.sync.job ?? 'N/A'}</Text>

              <Text color="secondary">Last Ref:</Text>
              <Text variant="body">{status?.sync.hash ? status.sync.hash.substring(0, 7) : 'N/A'}</Text>

              <Text color="secondary">Started:</Text>
              <Text variant="body">{formatTimestamp(status?.sync.started)}</Text>

              <Text color="secondary">Finished:</Text>
              <Text variant="body">{formatTimestamp(status?.sync.finished)}</Text>
            </div>
          </Card.Description>
          <Card.Actions>
            <SyncRepository repository={repo} />
          </Card.Actions>
        </Card>
      </Stack>
    </Box>
  );
}

function getRemoteURL(repo: Repository) {
  if (repo.spec?.type === 'github') {
    const spec = repo.spec.github;
    let url = `https://github.com/${spec?.owner}/${spec?.repository}/`;
    if (spec?.branch) {
      url += `tree/${spec.branch}`;
    }
    return url;
  }
  return undefined;
}

function getWebhookURL(repo: Repository) {
  const { status, spec } = repo;
  if (spec?.type === 'github' && status?.webhook?.url) {
    const { github } = spec;
    return `https://github.com/${github?.owner}/${github?.repository}/settings/hooks/${status.webhook?.id}`;
  }
  return undefined;
}

function getFolderURL(repo: Repository) {
  if (repo.spec?.sync.target === 'folder') {
    return `/dashboards/f/${repo.metadata?.name}`;
  }
  return '/dashboards';
}

import { Stack, Text, LinkButton, Card, TextLink, InteractiveTable } from '@grafana/ui';
import { CellProps } from '@grafana/ui';
import { useMemo } from 'react';

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
        <Card.Meta>
          {repo.status?.stats ? (
            <InteractiveTable
              columns={useMemo(
                () => [
                  {
                    id: 'resource',
                    header: 'Resource',
                    cell: ({ row: { original } }: StatCell<'resource'>) => {
                      return <span>{original.resource}</span>;
                    },
                  },
                  {
                    id: 'group',
                    header: 'Group',
                    cell: ({ row: { original } }: StatCell<'group'>) => {
                      return <span>{original.group}</span>;
                    },
                  },
                  {
                    id: 'count',
                    header: 'Count',
                    cell: ({ row: { original } }: StatCell<'count'>) => {
                      return <span>{original.count}</span>;
                    },
                  },
                ],
                []
              )}
              data={repo.status.stats}
              getRowId={(r: StatItem) => `${r.group}-${r.resource}`}
            />
          ) : null}
        </Card.Meta>
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
        <Card.Meta>
          <ul style={{ listStyle: 'none' }}>
            <li>
              Job ID: <b>{status?.sync.job ?? 'N/A'}</b>
            </li>
            <li>
              Last Ref: <b>{status?.sync.hash ?? 'N/A'}</b>
            </li>
            <li>
              Started: <b>{formatTimestamp(status?.sync.started)}</b>
            </li>
            <li>
              Finished: <b>{formatTimestamp(status?.sync.finished)}</b>
            </li>
          </ul>
        </Card.Meta>
        <Card.Actions>
          <SyncRepository repository={repo} />
        </Card.Actions>
      </Card>
    </Stack>
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

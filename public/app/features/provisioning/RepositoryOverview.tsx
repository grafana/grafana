import { useMemo } from 'react';

import { CellProps, Stack, Box, Text, LinkButton, Card, TextLink, InteractiveTable } from '@grafana/ui';

import { CheckRepository } from './CheckRepository';
import { RepositoryHealth } from './RepositoryHealth';
import { SyncRepository } from './SyncRepository';
import { Repository, ResourceCount } from './api';
import { formatTimestamp } from './utils/time';

type StatCell<T extends keyof ResourceCount = keyof ResourceCount> = CellProps<ResourceCount, ResourceCount[T]>;

export function RepositoryOverview({ repo }: { repo: Repository }) {
  const remoteURL = getRemoteURL(repo);
  const webhookURL = getWebhookURL(repo);
  const status = repo.status;

  const resourceColumns = useMemo(
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
  );
  return (
    <Box padding={2}>
      <Stack gap={2} direction="row" justifyContent="center">
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
                columns={resourceColumns}
                data={repo.status.stats}
                getRowId={(r: ResourceCount) => `${r.group}-${r.resource}`}
              />
            ) : null}
          </Card.Description>
        </Card>
      </Stack>
      <Stack gap={2} direction="row" alignItems="stretch" justifyContent="center">
        {repo.status?.health && (
          <Card>
            <Card.Heading>Health</Card.Heading>
            <Card.Description>
              <RepositoryHealth health={repo.status?.health} />
              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '8px', alignItems: 'baseline' }}>
                <Text color="secondary">Status:</Text>
                <Text variant="body">{status?.health?.healthy ? 'Healthy' : 'Unhealthy'}</Text>

                <Text color="secondary">Checked:</Text>
                <Text variant="body">{formatTimestamp(status?.health?.checked)}</Text>

                {status?.health?.message && status.health.message.length > 0 && (
                  <>
                    <Text color="secondary">Messages:</Text>
                    <Stack gap={1}>
                      {status.health.message.map((msg, idx) => (
                        <Text key={idx} variant="body">
                          {msg}
                        </Text>
                      ))}
                    </Stack>
                  </>
                )}
              </div>
            </Card.Description>

            <Card.Actions>
              <CheckRepository repository={repo} />
            </Card.Actions>
          </Card>
        )}
        <Card>
          <Card.Heading>Sync Status </Card.Heading>
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

              {status?.sync?.message && status.sync.message.length > 0 && (
                <>
                  <Text color="secondary">Messages:</Text>
                  <Stack gap={1}>
                    {status.sync.message.map((msg, idx) => (
                      <Text key={idx} variant="body">
                        {msg}
                      </Text>
                    ))}
                  </Stack>
                </>
              )}
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
    let url = spec?.url || '';
    if (spec?.branch) {
      url += `/tree/${spec.branch}`;
    }
    return url;
  }
  return undefined;
}

function getWebhookURL(repo: Repository) {
  const { status, spec } = repo;
  if (spec?.type === 'github' && status?.webhook?.url && spec.github?.url) {
    return `${spec.github.url}/settings/hooks/${status.webhook?.id}`;
  }
  return undefined;
}

function getFolderURL(repo: Repository) {
  if (repo.spec?.sync.target === 'folder') {
    return `/dashboards/f/${repo.metadata?.name}`;
  }
  return '/dashboards';
}

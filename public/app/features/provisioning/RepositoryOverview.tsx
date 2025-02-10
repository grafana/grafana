import { Stack, Button, Text, LinkButton, Card, TextLink } from '@grafana/ui';

import { CheckRepository } from './CheckRepository';
import { RepositoryHealth } from './RepositoryHealth';
import { StatusBadge } from './StatusBadge';
import { SyncRepository } from './SyncRepository';
import { Repository, ResourceCount } from './api';
import { formatTimestamp } from './utils/time';

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
      </Card>
      <Card>
        <Card.Heading>Resources</Card.Heading>
        <Card.Meta>
          {repo.status?.stats?.length && (
            <Stack>
              {repo.status.stats.map((v, index) => (
                <LinkButton key={index} fill="outline" size="md" href={getListURL(repo, v)}>
                  {v.count} {v.resource}
                </LinkButton>
              ))}
            </Stack>
          )}
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

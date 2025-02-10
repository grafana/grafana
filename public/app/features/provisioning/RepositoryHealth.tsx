import { TextLink, Stack, Alert, Text } from '@grafana/ui';

import { Repository } from './api';

export function RepositoryHealth({ repo }: { repo: Repository }) {
  const status = repo.status;
  const remoteURL = getRemoteURL(repo);
  const webhookURL = getWebhookURL(repo);

  return (
    <Stack gap={2} direction="column" alignItems="flex-start">
      {status?.health?.healthy ? (
        <Alert title="Repository is healthy" severity="success" style={{ width: '100%' }}>
          No errors found
        </Alert>
      ) : (
        <Alert title="Repository is unhealthy" severity="warning" style={{ width: '100%' }}>
          {status?.health?.message && status.health.message.length > 0 && (
            <>
              <Text>Details:</Text>
              <ul>
                {status.health.message.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </>
          )}
        </Alert>
      )}

      <h3>Details</h3>
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

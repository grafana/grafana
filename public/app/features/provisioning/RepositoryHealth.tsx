import { Stack, Alert, Text } from '@grafana/ui';

import { Repository } from './api';

export function RepositoryHealth({ repo }: { repo: Repository }) {
  const status = repo.status;

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
    </Stack>
  );
}

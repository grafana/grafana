import { Stack, Alert, Text } from '@grafana/ui';
import { HealthStatus } from 'app/api/clients/provisioning';

interface Props {
  health: HealthStatus;
}

export function RepositoryHealth({ health }: Props) {
  return (
    <Stack gap={2} direction="column" alignItems="flex-start">
      {health.healthy ? (
        <Alert title="Repository is healthy" severity="success" style={{ width: '100%' }}>
          No errors found
        </Alert>
      ) : (
        <Alert title="Repository is unhealthy" severity="warning" style={{ width: '100%' }}>
          {health.message && health.message.length > 0 && (
            <>
              <Text>Details:</Text>
              <ul>
                {health.message.map((message) => (
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

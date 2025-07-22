import { Trans, t } from '@grafana/i18n';
import { Stack, Alert, Text } from '@grafana/ui';
import { HealthStatus } from 'app/api/clients/provisioning/v0alpha1';

interface Props {
  health: HealthStatus;
}

export function RepositoryHealth({ health }: Props) {
  return (
    <Stack gap={2} direction="column" alignItems="flex-start">
      {health.healthy ? (
        <Alert
          title={t('provisioning.repository-health.title-repository-is-healthy', 'Repository is healthy')}
          severity="success"
          style={{ width: '100%' }}
        >
          <Trans i18nKey="provisioning.repository-health.no-errors-found">No errors found</Trans>
        </Alert>
      ) : (
        <Alert
          title={t('provisioning.repository-health.title-repository-is-unhealthy', 'Repository is unhealthy')}
          severity="warning"
          style={{ width: '100%' }}
        >
          {health.message && health.message.length > 0 && (
            <>
              <Text>
                <Trans i18nKey="provisioning.repository-health.details">Details:</Trans>
              </Text>
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

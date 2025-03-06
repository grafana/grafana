import { Alert, Button, Stack } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

export function FederatedRuleWarning() {
  return (
    <Alert
      severity="info"
      title={t('alerting.federated-rule-warning.title-federated-group', 'This rule is part of a federated rule group.')}
      bottomSpacing={0}
      topSpacing={2}
    >
      <Stack direction="column">
        Federated rule groups are currently an experimental feature.
        <Button fill="text" icon="book">
          <a href="https://grafana.com/docs/metrics-enterprise/latest/tenant-management/tenant-federation/#cross-tenant-alerting-and-recording-rule-federation">
            <Trans i18nKey="alerting.federated-rule-warning.read-documentation">Read documentation</Trans>
          </a>
        </Button>
      </Stack>
    </Alert>
  );
}

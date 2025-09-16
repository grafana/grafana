import { Trans, t } from '@grafana/i18n';
import { Alert, Button, Stack } from '@grafana/ui';

export function FederatedRuleWarning() {
  return (
    <Alert
      severity="info"
      title={t('alerting.federated-rule-warning.title-federated-group', 'This rule is part of a federated rule group.')}
      bottomSpacing={0}
      topSpacing={2}
    >
      <Stack direction="column">
        <Trans i18nKey="alerting.federated-rule-warning.experimental">
          Federated rule groups are currently an experimental feature.
        </Trans>
        <Button fill="text" icon="book">
          <a href="https://grafana.com/docs/metrics-enterprise/latest/tenant-management/tenant-federation/#cross-tenant-alerting-and-recording-rule-federation">
            <Trans i18nKey="alerting.federated-rule-warning.read-documentation">Read documentation</Trans>
          </a>
        </Button>
      </Stack>
    </Alert>
  );
}

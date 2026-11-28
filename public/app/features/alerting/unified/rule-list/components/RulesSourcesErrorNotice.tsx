import { Trans, t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';

/**
 * Says that data source-managed rules are missing because the rules source list did not load. Without it a
 * failed list looks the same as a list with no data source-managed rules sources.
 */
export function RulesSourcesErrorNotice({ error }: { error?: Error }) {
  if (!error) {
    return null;
  }

  return (
    <Alert
      severity="warning"
      title={t('alerting.rule-list.rules-sources-error.title', 'Could not load the data source list')}
    >
      <Trans i18nKey="alerting.rule-list.rules-sources-error.body">
        Data source-managed rules are missing from the results.
      </Trans>
    </Alert>
  );
}

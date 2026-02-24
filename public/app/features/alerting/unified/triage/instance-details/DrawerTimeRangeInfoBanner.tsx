import { Trans, t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';

/**
 * Info banner shown when the drawer time range is shorter than the rule's query evaluation window,
 */
export function DrawerTimeRangeInfoBanner() {
  return (
    <Alert
      severity="info"
      title={t('alerting.instance-details.drawer-time-range-short.title', 'Time range shorter than evaluation window')}
    >
      <Trans i18nKey="alerting.instance-details.drawer-time-range-short.description">
        The selected time range is shorter than the rule&apos;s query evaluation window so a graph may not be available.
      </Trans>
    </Alert>
  );
}

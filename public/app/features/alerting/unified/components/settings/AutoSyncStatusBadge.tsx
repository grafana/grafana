import { t } from '@grafana/i18n';
import { Badge } from '@grafana/ui';

import { type AutoSyncState } from './useAutoSyncConfiguration';

/**
 * Status badge for the external Alertmanager auto-sync feature. Shared between the
 * Settings page and the import wizard so both render the same Active/Not configured
 * presentation.
 */
export function AutoSyncStatusBadge({ state }: { state: AutoSyncState }) {
  if (state.kind === 'operator-managed') {
    return (
      <Badge
        text={t('alerting.settings.auto-sync.badge-operator-managed', 'Managed by operator')}
        color="blue"
        icon="lock"
      />
    );
  }
  if (state.kind === 'configured' || state.kind === 'orphan-uid') {
    return <Badge text={t('alerting.settings.auto-sync.badge-active', 'Active')} color="green" />;
  }
  if (state.kind === 'unconfigured') {
    return <Badge text={t('alerting.settings.auto-sync.badge-not-configured', 'Not configured')} color="blue" />;
  }
  return null;
}

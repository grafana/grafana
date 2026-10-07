import { t } from '@grafana/i18n';
import { Badge } from '@grafana/ui';

import { type AutoSyncHealth, type AutoSyncState, describeSyncHealth } from '../../utils/autoSync';

interface AutoSyncStatusBadgeProps {
  state: AutoSyncState;
  /** Health from the ExternalAlertmanagerSynced condition. */
  syncHealth: AutoSyncHealth;
}

/**
 * Status badge for the external Alertmanager auto-sync feature. `state` decides whether sync is
 * configured at all; `syncHealth` refines the configured case into Active / Pending / Failing /
 * Sync stopped.
 */
export function AutoSyncStatusBadge({ state, syncHealth }: AutoSyncStatusBadgeProps) {
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
    if (syncHealth.kind === 'failing') {
      return (
        <Badge
          text={t('alerting.settings.auto-sync.badge-failing', 'Sync failing')}
          color="red"
          icon="exclamation-triangle"
          tooltip={describeSyncHealth(syncHealth)}
        />
      );
    }
    if (syncHealth.kind === 'pending') {
      return (
        <Badge
          text={t('alerting.settings.auto-sync.badge-pending', 'Pending first sync')}
          color="orange"
          icon="sync"
          tooltip={describeSyncHealth(syncHealth)}
        />
      );
    }
    // The merge is terminal: the worker has stopped, so this must not read as a running sync.
    if (syncHealth.kind === 'merge-committed') {
      return (
        <Badge text={t('alerting.settings.auto-sync.badge-stopped', 'Sync stopped')} color="blue" icon="info-circle" />
      );
    }
    return <Badge text={t('alerting.settings.auto-sync.badge-active', 'Active')} color="green" />;
  }
  if (state.kind === 'unconfigured') {
    return <Badge text={t('alerting.settings.auto-sync.badge-not-configured', 'Not configured')} color="blue" />;
  }
  return null;
}

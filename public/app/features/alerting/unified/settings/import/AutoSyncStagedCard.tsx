import { noop } from 'lodash';

import { Trans, t } from '@grafana/i18n';
import { Badge, Button, Select, Text } from '@grafana/ui';
import { type AlertmanagerConfig } from 'app/plugins/datasource/alertmanager/types';

import { AlertmanagerDataSourceOption } from '../../components/settings/AlertmanagerDataSourceOptions';
import {
  AutoSyncNotices,
  DisableSyncButton,
  getSaveDisabledReason,
  useDatasourceOptions,
} from '../../components/settings/AutoSyncConfiguration';
import { SyncedCopyStatusBadge } from '../../components/settings/AutoSyncStatusBadge';
import { type useAutoSyncConfiguration } from '../../components/settings/useAutoSyncConfiguration';
import { hasAutoSyncSource, isOperatorManaged } from '../../utils/autoSync';

import { StagedCard, StagedConfiguration } from './StagedConfiguration';
import { type StagedExtraConfig } from './stagedConfig';

interface Props {
  autoSync: ReturnType<typeof useAutoSyncConfiguration>;
  /** The staged copy the sync keeps up to date. Missing until the first sync lands. */
  syncedConfig?: StagedExtraConfig;
  /** Another import that occupies the staged slot, which keeps the sync from writing its own copy. */
  conflictIdentifier?: string;
  liveConfig?: AlertmanagerConfig;
  canPromote: boolean;
  canRevert: boolean;
}

/**
 * The staged configuration while auto-sync is set up, or once it is turned off while its last copy is
 * still staged: the sync's datasource and status, the actions to stop or restart it and to promote or
 * revert what it synced, and what it synced. Setting sync up from scratch happens in
 * AutoSyncConfiguration instead.
 */
export function AutoSyncStagedCard({
  autoSync,
  syncedConfig,
  conflictIdentifier,
  liveConfig,
  canPromote,
  canRevert,
}: Props) {
  const {
    state,
    syncHealth,
    autoSyncEligibleAlertmanagers,
    selectedUid,
    lastSyncedUid,
    setSelectedUid,
    getSyncIdentifier,
    save,
    disableSync,
    isPending,
    isLoading,
    notReadyMessage,
  } = autoSync;
  const options = useDatasourceOptions(autoSyncEligibleAlertmanagers);

  // Turned off, with the copy from its last run still staged. Picking a datasource here turns it back on.
  const isStopped = state.kind === 'unconfigured';
  const savedUid = hasAutoSyncSource(state) ? state.uid : '';
  // Start from the datasource the copy came from, so re-enabling is one click.
  const pickedUid = isStopped ? selectedUid || lastSyncedUid : savedUid;

  // Running, the picker is read-only: switching datasources means disabling sync first, since its copy
  // keeps the staged slot.
  const title = (
    <Select
      inputId="auto-sync-staged-datasource"
      aria-label={t('alerting.settings.auto-sync.picker-label', 'Datasource')}
      components={{ Option: AlertmanagerDataSourceOption }}
      options={options}
      value={pickedUid || null}
      onChange={isStopped ? (option) => option?.value && setSelectedUid(option.value) : noop}
      disabled={!isStopped || isLoading}
      isLoading={isLoading}
      width={40}
      placeholder={t(
        'alerting.settings.auto-sync.picker-placeholder',
        'Select a Mimir or Cortex Alertmanager datasource…'
      )}
    />
  );

  const badge = isStopped ? (
    <Badge color="darkgrey" icon="pause" text={t('alerting.settings.auto-sync.badge-stopped', 'Sync stopped')} />
  ) : (
    <SyncedCopyStatusBadge uid={savedUid} syncHealth={syncHealth} hasSyncedCopy={Boolean(syncedConfig)} />
  );

  // The sync writes into the one staged slot under its own name, so it can only restart from a datasource
  // whose name matches the copy that's there.
  const stagedIdentifier = syncedConfig?.identifier ?? conflictIdentifier;
  const enableDisabledReason = getSaveDisabledReason({
    notReadyMessage,
    selectedUid: pickedUid,
    savedUid,
    savingWouldBreakSync: Boolean(stagedIdentifier) && stagedIdentifier !== getSyncIdentifier(pickedUid),
  });

  let syncAction;
  if (isStopped) {
    syncAction = (
      <Button
        variant="secondary"
        onClick={() => save(pickedUid)}
        disabled={Boolean(enableDisabledReason) || isPending}
        tooltip={enableDisabledReason}
      >
        <Trans i18nKey="alerting.settings.auto-sync.action-enable">Enable sync</Trans>
      </Button>
    );
  } else if (!isOperatorManaged(state)) {
    // An operator-managed sync is set in grafana.ini and can't be turned off from here.
    syncAction = <DisableSyncButton state={state} disableSync={disableSync} isPending={isPending} />;
  }

  const notices = (
    <>
      <AutoSyncNotices
        state={state}
        syncHealth={syncHealth}
        conflict={conflictIdentifier ? { identifier: conflictIdentifier, isRunningSyncBroken: true } : undefined}
      />
      {isStopped && (
        <Text variant="bodySmall" color="secondary">
          <Trans i18nKey="alerting.settings.auto-sync.stopped-description">
            Auto-sync is off. This is the last configuration it synced, and it no longer changes. Enable sync to keep it
            up to date again, or promote or revert it.
          </Trans>
        </Text>
      )}
    </>
  );

  if (syncedConfig) {
    return (
      <StagedConfiguration
        stagedConfig={syncedConfig}
        isSyncManaged={!isStopped}
        canPromote={canPromote}
        canRevert={canRevert}
        liveConfig={liveConfig}
        title={title}
        badge={badge}
        extraActions={syncAction}
        notices={notices}
      />
    );
  }

  return (
    <StagedCard title={title} badge={badge} actions={syncAction}>
      {notices}
      {syncHealth.kind === 'pending' && (
        <Text variant="bodySmall" color="secondary">
          {t(
            'alerting.settings.auto-sync.waiting-first-sync',
            'Waiting for the first sync. This usually takes a minute or two.'
          )}
        </Text>
      )}
    </StagedCard>
  );
}

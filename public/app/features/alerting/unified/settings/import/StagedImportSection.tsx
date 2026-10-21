import { useEffect } from 'react';

import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Alert, Button, LoadingPlaceholder, Stack, Text } from '@grafana/ui';

import { logError } from '../../Analytics';
import { useAutoSyncConfiguration } from '../../components/settings/useAutoSyncConfiguration';
import { AlertmanagerProvider } from '../../state/AlertmanagerContext';
import { hasAutoSyncSource } from '../../utils/autoSync';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { stringifyErrorLike } from '../../utils/misc';

import { AutoSyncStagedCard } from './AutoSyncStagedCard';
import { StagedConfiguration } from './StagedConfiguration';
import { type StagedExtraConfig } from './stagedConfig';
import { getStagedConfigPermissions } from './stagedConfigPermissions';
import { useRefetchStagedConfigOnSyncChange, useStagedConfig } from './useStagedConfig';

/**
 * What an earlier import left staged, or the copy auto-sync keeps, with the actions to promote or revert
 * it and to stop or restart the sync. Shows nothing while there is neither.
 */
export function StagedImportSection() {
  const isAutoSyncEnabled = config.featureToggles['alerting.syncExternalAlertmanager'];
  return (
    <AlertmanagerProvider accessType="notification" alertmanagerSourceName={GRAFANA_RULES_SOURCE_NAME}>
      {isAutoSyncEnabled ? <StagedImportWithAutoSync /> : <StagedConfigurationSection />}
    </AlertmanagerProvider>
  );
}

function StagedImportWithAutoSync() {
  const { stagedConfig, refetch: refetchStagedConfig } = useStagedConfig();
  useRefetchStagedConfigOnSyncChange(refetchStagedConfig);
  const autoSync = useAutoSyncConfiguration();

  // Deciding between the two layouts needs the sync setting; guessing would flash the wrong one.
  if (autoSync.isLoading) {
    return <LoadingPlaceholder text={t('alerting.settings.import.loading', 'Loading imported configurations…')} />;
  }

  // Once sync is set up, its setting and the staged copy it keeps are one thing, shown in one card. That
  // stays so after sync is turned off while its last copy is still staged, so it can be turned back on
  // from the same place. Turning sync on from scratch is an option of the wizard's notifications step.
  const isSyncSetUp = autoSync.state.kind === 'configured' || autoSync.state.kind === 'operator-managed';
  const hasStoppedSyncCopy = Boolean(stagedConfig && isStoppedSyncCopy(autoSync, stagedConfig));
  const showSyncCard = isSyncSetUp || hasStoppedSyncCopy;

  return <StagedConfigurationSection autoSync={showSyncCard ? autoSync : undefined} />;
}

/**
 * Whether the staged config is the copy a sync left behind when it was turned off. Once sync is off the
 * backend no longer marks the copy as auto-sync, but the status still remembers the datasource the sync
 * last ran from and the name it imported under.
 */
function isStoppedSyncCopy(autoSync: ReturnType<typeof useAutoSyncConfiguration>, stagedConfig: StagedExtraConfig) {
  return (
    autoSync.state.kind === 'unconfigured' &&
    Boolean(autoSync.lastSyncedUid) &&
    stagedConfig.identifier === autoSync.getSyncIdentifier(autoSync.lastSyncedUid)
  );
}

interface StagedConfigurationSectionProps {
  /** Set while auto-sync is set up, so the section shows the sync and its copy together. */
  autoSync?: ReturnType<typeof useAutoSyncConfiguration>;
}

function StagedConfigurationSection({ autoSync }: StagedConfigurationSectionProps) {
  const { canPromote, canRevert } = getStagedConfigPermissions();
  const { stagedConfig, liveConfig, isLoading, isError, error, refetch } = useStagedConfig();

  const isSyncManaged = stagedConfig?.managed_by === 'auto-sync';
  const syncUid = autoSync && hasAutoSyncSource(autoSync.state) ? autoSync.state.uid : '';
  // The sync's own copy, or another import that keeps the sync from writing one.
  const isSyncedCopy = Boolean(
    autoSync &&
      stagedConfig &&
      (autoSync.state.kind === 'unconfigured'
        ? isStoppedSyncCopy(autoSync, stagedConfig)
        : stagedConfig.identifier === autoSync.getSyncIdentifier(syncUid))
  );
  const otherStagedConfig = stagedConfig && !isSyncedCopy ? stagedConfig : undefined;

  useEffect(() => {
    if (isError) {
      logError(new Error(stringifyErrorLike(error)));
    }
  }, [isError, error]);

  if (!isLoading && !isError && !autoSync && !stagedConfig) {
    return null;
  }

  return (
    <Stack direction="column" gap={1}>
      <Text variant="h4">
        <Trans i18nKey="alerting.settings.import.staged-title">Staged configuration</Trans>
      </Text>
      <Text variant="bodySmall" color="secondary">
        <Trans i18nKey="alerting.settings.import.staged-description">
          A read-only, reversible copy of an imported Alertmanager config. Promote it to merge into your live config, or
          revert to remove it.
        </Trans>
      </Text>

      {isLoading && (
        <LoadingPlaceholder text={t('alerting.settings.import.loading', 'Loading imported configurations…')} />
      )}

      {isError && (
        <Alert
          severity="error"
          title={t('alerting.settings.import.error-title', "Couldn't load imported configurations")}
        >
          <Stack direction="column" gap={2} alignItems="flex-start">
            <Trans i18nKey="alerting.settings.import.error-body">
              The request to the Alerting API failed. Check your connection and try again.
            </Trans>
            <Button variant="secondary" fill="outline" icon="sync" onClick={() => refetch()}>
              <Trans i18nKey="alerting.settings.import.error-retry">Retry</Trans>
            </Button>
          </Stack>
        </Alert>
      )}

      {!isLoading && !isError && autoSync && (
        <AutoSyncStagedCard
          autoSync={autoSync}
          syncedConfig={isSyncedCopy ? stagedConfig : undefined}
          conflictIdentifier={otherStagedConfig?.identifier}
          liveConfig={liveConfig}
          canPromote={canPromote}
          canRevert={canRevert}
        />
      )}

      {!isLoading && !isError && autoSync && otherStagedConfig && (
        <StagedConfiguration
          stagedConfig={otherStagedConfig}
          canPromote={canPromote}
          canRevert={canRevert}
          liveConfig={liveConfig}
        />
      )}

      {!isLoading && !isError && !autoSync && stagedConfig && (
        <StagedConfiguration
          stagedConfig={stagedConfig}
          canPromote={canPromote}
          canRevert={canRevert}
          isSyncManaged={isSyncManaged}
          liveConfig={liveConfig}
        />
      )}
    </Stack>
  );
}

import { useEffect, useMemo, useState } from 'react';

import { type DataSourceSettings } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useAppNotification } from 'app/core/copy/appNotification';
import { type AlertManagerDataSourceJsonData } from 'app/plugins/datasource/alertmanager/types';
import { useDispatch } from 'app/types/store';

import { logError } from '../../Analytics';
import { ALERTMANAGER_PROVIDED_ENTITY_TAGS, alertmanagerApi } from '../../api/alertmanagerApi';
import { CONFIG_SINGLETON_NAME, configApi, useAutoSyncConfigQuery } from '../../api/configApi';
import { dataSourcesApi } from '../../api/dataSourcesApi';
import { isNotFoundError } from '../../api/util';
import {
  type AutoSyncHealth,
  type AutoSyncState,
  autoSyncInitializingMessage,
  deriveAutoSyncState,
  deriveReadiness,
  deriveSyncHealth,
  deriveSyncSource,
  filterMimirCortexDatasources,
} from '../../utils/autoSync';
import { AUTO_SYNC_CONFIG_POLL_INTERVAL_MS } from '../../utils/constants';
import { stringifyErrorLike } from '../../utils/misc';

export interface UseAutoSyncConfigurationResult {
  state: AutoSyncState;
  /** Health of the last sync attempt, for the status badge and the failure and merge callouts. */
  syncHealth: AutoSyncHealth;
  mimirCortexDatasources: Array<DataSourceSettings<AlertManagerDataSourceJsonData>>;
  selectedUid: string;
  setSelectedUid: (uid: string) => void;
  /** Persists the given UID (or the current selection). Resolves to true on success. */
  save: (uidOverride?: string) => Promise<boolean>;
  /** Clears the synced UID. Resolves to true on success. */
  disableSync: () => Promise<boolean>;
  isPending: boolean;
  isLoading: boolean;
  /** Whether `save`/`disableSync` can do anything — gate write affordances on this. */
  isReady: boolean;
  /** Why `isReady` is false, as copy to render next to the affordance it disabled. */
  notReadyMessage?: string;
}

export function useAutoSyncConfiguration(): UseAutoSyncConfigurationResult {
  const {
    currentData: configResource,
    isLoading: isLoadingConfig,
    error: configError,
  } = useAutoSyncConfigQuery({
    // The sync worker owns seeding the singleton, and nothing here invalidates the Config — without
    // polling, a pre-seed 404 stays cached as a rejection and "try again in a moment" never comes true.
    pollingInterval: AUTO_SYNC_CONFIG_POLL_INTERVAL_MS,
    skipPollingIfUnfocused: true,
    refetchOnMountOrArgChange: true,
  });
  const { currentData: allDatasources, isLoading: isLoadingDatasources } =
    dataSourcesApi.endpoints.getAllDataSourceSettings.useQuery(undefined, {
      refetchOnMountOrArgChange: true,
    });
  const [updateConfig, updateConfigState] = configApi.useUpdateConfigMutation();

  const mimirCortexDatasources = useMemo(() => filterMimirCortexDatasources(allDatasources), [allDatasources]);
  const source = useMemo(() => deriveSyncSource(configResource), [configResource]);

  // Kept apart from the saved value so a background refetch cannot overwrite an in-flight choice.
  const [selectedOverride, setSelectedOverride] = useState<string | null>(null);
  const selectedUid = selectedOverride ?? source.uid;

  const state = useMemo(() => deriveAutoSyncState(source, mimirCortexDatasources), [source, mimirCortexDatasources]);
  const { isReady, notReadyMessage, readErrorMessage, readErrorStatus } = deriveReadiness(configResource, configError);

  const syncHealth = useMemo(() => deriveSyncHealth(configResource, source.uid), [configResource, source.uid]);

  const notify = useAppNotification();
  const dispatch = useDispatch();

  // Nothing else reports a failed read, and the tooltip is only seen by an admin who hovers it. Keyed
  // on the message, not the error object, which the poll hands back new on every failing tick.
  useEffect(() => {
    if (!readErrorMessage) {
      return;
    }
    logError(new Error(readErrorMessage), {
      operation: 'getAutoSyncConfig',
      ...(readErrorStatus && { status: readErrorStatus }),
    });
  }, [readErrorMessage, readErrorStatus]);

  const notifyNotReady = () => {
    if (readErrorMessage) {
      notify.error(
        t('alerting.settings.auto-sync.read-error-title', 'Could not load the auto-sync configuration'),
        readErrorMessage
      );
      return;
    }
    notify.error(
      t('alerting.settings.auto-sync.not-ready-title', 'Auto-sync is still initializing'),
      autoSyncInitializingMessage()
    );
  };

  const persist = async (uid: string): Promise<boolean> => {
    if (!configResource) {
      notifyNotReady();
      return false;
    }

    try {
      await updateConfig({
        name: CONFIG_SINGLETON_NAME,
        // Spec-scoped patch, not a whole-object PUT: the worker writes `status` every tick, so a PUT
        // pinning metadata.resourceVersion 409s. Patching the parent path survives it being absent.
        patch: [
          {
            op: 'add',
            path: '/spec/externalAlertmanagerSync',
            value: uid ? { datasourceUid: uid } : {},
          },
        ],
      }).unwrap();
      // updateConfig invalidates only 'Config', in a different RTKQ slice; toggling sync rewrites the
      // Alertmanager entities the worker imports.
      dispatch(alertmanagerApi.util.invalidateTags([...ALERTMANAGER_PROVIDED_ENTITY_TAGS]));
      notify.success(
        uid
          ? t('alerting.settings.auto-sync.save-success', 'Mimir Alertmanager auto-sync enabled')
          : t('alerting.settings.auto-sync.disable-success', 'Mimir Alertmanager auto-sync disabled')
      );
      setSelectedOverride(null);
      return true;
    } catch (err) {
      // The singleton disappeared between load and save (or was never seeded).
      if (isNotFoundError(err)) {
        notifyNotReady();
        return false;
      }
      notify.error(
        t('alerting.settings.auto-sync.save-error', 'Failed to save Mimir Alertmanager auto-sync'),
        stringifyErrorLike(err)
      );
      return false;
    }
  };

  return {
    state,
    syncHealth,
    mimirCortexDatasources,
    selectedUid,
    setSelectedUid: (uid: string) => setSelectedOverride(uid),
    save: (uidOverride?: string) => persist(uidOverride ?? selectedUid),
    // Clearing the UID, not deleting: delete is denied on the singleton, and admission permits clearing.
    disableSync: () => persist(''),
    isPending: updateConfigState.isLoading,
    isLoading: isLoadingConfig || isLoadingDatasources,
    isReady,
    notReadyMessage,
  };
}

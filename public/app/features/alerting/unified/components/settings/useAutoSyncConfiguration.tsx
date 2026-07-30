import { skipToken } from '@reduxjs/toolkit/query';
import { useEffect, useMemo, useState } from 'react';

import { type DataSourceSettings } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, isFetchError } from '@grafana/runtime';
import { useAppNotification } from 'app/core/copy/appNotification';
import { contextSrv } from 'app/core/services/context_srv';
import {
  type AlertManagerDataSourceJsonData,
  AlertManagerImplementation,
} from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';
import { useDispatch } from 'app/types/store';

import { logError } from '../../Analytics';
import { ALERTMANAGER_PROVIDED_ENTITY_TAGS, alertmanagerApi } from '../../api/alertmanagerApi';
import { CONFIG_SINGLETON_NAME, configApi } from '../../api/configApi';
import { dataSourcesApi } from '../../api/dataSourcesApi';
import { isNotFoundError } from '../../api/util';
import { AUTO_SYNC_CONFIG_POLL_INTERVAL_MS } from '../../utils/constants';
import { isAlertmanagerDataSource } from '../../utils/datasource';
import { stringifyErrorLike } from '../../utils/misc';

export type AutoSyncState =
  | { kind: 'unconfigured' }
  | { kind: 'configured'; uid: string }
  | { kind: 'operator-managed'; uid: string }
  | { kind: 'no-datasources' }
  | { kind: 'orphan-uid'; uid: string };

export interface UseAutoSyncConfigurationResult {
  state: AutoSyncState;
  mimirCortexDatasources: Array<DataSourceSettings<AlertManagerDataSourceJsonData>>;
  selectedUid: string;
  setSelectedUid: (uid: string) => void;
  /** Persists the given UID (or the current selection). Resolves to true on success. */
  save: (uidOverride?: string) => Promise<boolean>;
  /** Clears the synced UID. Resolves to true on success. */
  disableSync: () => Promise<boolean>;
  isPending: boolean;
  isLoading: boolean;
  /**
   * Whether `save`/`disableSync` can do anything: humans cannot create the Config singleton, so a
   * write needs it to already exist. False while the read is in flight and also when it resolved to
   * nothing (404 before the worker's first tick, the read failed, or the query was skipped), which
   * `isLoading` alone cannot express. Gate write affordances on this.
   */
  isReady: boolean;
  /**
   * Why `isReady` is false, as copy to render next to the affordance it disabled — an unseeded
   * singleton and a failed read are both blocking but only the first is worth waiting out. Undefined
   * while ready.
   */
  notReadyMessage?: string;
}

const MIMIR_CORTEX_IMPLEMENTATIONS: AlertManagerImplementation[] = [
  AlertManagerImplementation.mimir,
  AlertManagerImplementation.cortex,
];

function isMimirOrCortex(ds: DataSourceSettings<AlertManagerDataSourceJsonData>): boolean {
  const impl = ds.jsonData?.implementation ?? AlertManagerImplementation.mimir;
  return MIMIR_CORTEX_IMPLEMENTATIONS.includes(impl);
}

export function hasConfiguredUid(state: AutoSyncState): state is Extract<AutoSyncState, { uid: string }> {
  return state.kind === 'configured' || state.kind === 'orphan-uid' || state.kind === 'operator-managed';
}

export function isOperatorManaged(state: AutoSyncState): state is Extract<AutoSyncState, { kind: 'operator-managed' }> {
  return state.kind === 'operator-managed';
}

export function useAutoSyncConfiguration(): UseAutoSyncConfigurationResult {
  // Gated exactly like useIsAutoSyncActive: without the read permission the request is a guaranteed
  // 403. Every render path is already flag-and-Admin gated, so this is defence in depth.
  const flagOn = config.featureToggles['alerting.syncExternalAlertmanager'] === true;
  const canReadConfig = contextSrv.hasPermission(AccessControlAction.ActionAlertingNotificationsConfigRead);
  const {
    currentData: configResource,
    isLoading: isLoadingConfig,
    error: configError,
  } = configApi.useGetConfigQuery(flagOn && canReadConfig ? { name: CONFIG_SINGLETON_NAME } : skipToken, {
    // Nothing on this page invalidates the Config: the sync worker owns both seeding the singleton
    // and rewriting its `status` on every tick. Without polling a 404 stays cached as a rejection,
    // so the "try again in a moment" copy on the disabled write affordances would never come true
    // for anyone who waits on the page instead of reloading.
    pollingInterval: AUTO_SYNC_CONFIG_POLL_INTERVAL_MS,
    skipPollingIfUnfocused: true,
    refetchOnMountOrArgChange: true,
  });
  const { currentData: allDatasources, isLoading: isLoadingDatasources } =
    dataSourcesApi.endpoints.getAllDataSourceSettings.useQuery(undefined, {
      refetchOnMountOrArgChange: true,
    });
  const [updateConfig, updateConfigState] = configApi.useUpdateConfigMutation();

  const mimirCortexDatasources = useMemo(
    () => (allDatasources ?? []).filter(isAlertmanagerDataSource).filter(isMimirOrCortex),
    [allDatasources]
  );

  const observedSync = configResource?.status?.externalAlertmanagerSync;
  // origin='ini' means the operator's grafana.ini key is authoritative for this org: spec is dormant
  // and admission rejects UID writes. Reading it here makes the state correct on load, where the
  // legacy API only revealed it via a 409 on a failed POST.
  const isIniManaged = observedSync?.origin === 'ini';
  const configuredUid = isIniManaged
    ? (observedSync?.datasourceUid ?? '')
    : (configResource?.spec?.externalAlertmanagerSync?.datasourceUid ?? '');
  const hasMatchingDatasource = mimirCortexDatasources.some((ds) => ds.uid === configuredUid);

  // Track user-edited selection separately from the saved value so a background refetch
  // doesn't overwrite an in-flight choice. Null means "follow the saved value".
  const [selectedOverride, setSelectedOverride] = useState<string | null>(null);
  const selectedUid = selectedOverride ?? configuredUid;

  const state: AutoSyncState = useMemo(() => {
    if (isIniManaged && configuredUid) {
      return { kind: 'operator-managed', uid: configuredUid };
    }
    if (configuredUid && hasMatchingDatasource) {
      return { kind: 'configured', uid: configuredUid };
    }
    if (configuredUid) {
      return { kind: 'orphan-uid', uid: configuredUid };
    }
    if (mimirCortexDatasources.length === 0) {
      return { kind: 'no-datasources' };
    }
    return { kind: 'unconfigured' };
  }, [isIniManaged, configuredUid, hasMatchingDatasource, mimirCortexDatasources.length]);

  const notify = useAppNotification();
  const dispatch = useDispatch();

  const isReady = Boolean(configResource);
  // A 404 is the expected pre-seed state and the poll above recovers from it. Anything else is a real
  // failure, and the k8s base query does not raise its own error alerts, so unless the two are
  // separated here a 500 is presented as initialization and "try again in a moment" never comes true.
  const readErrorMessage = configError && !isNotFoundError(configError) ? stringifyErrorLike(configError) : undefined;
  const readErrorStatus = isFetchError(configError) ? String(configError.status) : undefined;
  // Only meaningful while not ready: a poll that fails after a successful read keeps `currentData`, so
  // the page stays usable and that error is deliberately not surfaced.
  const notReadyMessage = isReady ? undefined : getNotReadyMessage(readErrorMessage);

  // Nothing else reports this: the base query suppresses its own error alerts, and the tooltip on the
  // disabled affordance is only seen by an admin who hovers it. Keyed on the message rather than the
  // error object, which the poll hands back new on every failing tick.
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
      initializingMessage()
    );
  };

  const persist = async (uid: string): Promise<boolean> => {
    // Humans cannot create the singleton — create is denied to non-service identities, and a PUT to
    // a missing object is re-authorized as create — so with nothing read there is nothing to write
    // into, whether the worker has yet to seed it or the read failed outright.
    if (!configResource) {
      notifyNotReady();
      return false;
    }

    try {
      await updateConfig({
        name: CONFIG_SINGLETON_NAME,
        // JSON Patch scoped to spec, NOT a whole-object PUT: the sync worker writes `status` on
        // every poll tick, so a PUT carrying metadata.resourceVersion 409s whenever a tick lands
        // between page load and save. Patching the whole sub-object rather than
        // .../datasourceUid also survives the parent path being absent, which it is on a freshly
        // seeded singleton.
        patch: [
          {
            op: 'add',
            path: '/spec/externalAlertmanagerSync',
            value: uid ? { datasourceUid: uid } : {},
          },
        ],
      }).unwrap();
      // updateConfig only invalidates 'Config', and it lives in a different RTKQ slice than
      // alertmanagerApi. Toggling sync rewrites the Alertmanager entities the worker imports, so
      // reproduce the tag set the legacy admin_config mutation invalidated.
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
    mimirCortexDatasources,
    selectedUid,
    setSelectedUid: (uid: string) => setSelectedOverride(uid),
    save: (uidOverride?: string) => persist(uidOverride ?? selectedUid),
    // Clearing the UID is the disable path: delete is denied on the singleton, and the admission
    // validator explicitly permits clearing even while the ini override is set.
    disableSync: () => persist(''),
    isPending: updateConfigState.isLoading,
    isLoading: isLoadingConfig || isLoadingDatasources,
    isReady,
    notReadyMessage,
  };
}

function initializingMessage(): string {
  return t(
    'alerting.settings.auto-sync.not-ready-body',
    'Grafana has not finished setting up auto-sync for this organization. Try again in a moment.'
  );
}

/**
 * User-facing copy for a false `isReady`. An unseeded singleton is genuinely transient, so telling the
 * user to wait is honest; a read that failed for any other reason is not.
 *
 * `{{-error}}`, not `{{error}}`: i18next escapes interpolated values by default, and apimachinery
 * messages quote the resource name — plain interpolation renders those quotes as `&quot;`.
 */
function getNotReadyMessage(readErrorMessage: string | undefined): string {
  if (readErrorMessage) {
    return t(
      'alerting.settings.auto-sync.read-error-message',
      'Could not load the auto-sync configuration: {{-error}}',
      { error: readErrorMessage }
    );
  }
  return initializingMessage();
}

import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo, useState } from 'react';

import { type DataSourceSettings } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { useAppNotification } from 'app/core/copy/appNotification';
import { contextSrv } from 'app/core/services/context_srv';
import {
  type AlertManagerDataSourceJsonData,
  AlertManagerImplementation,
} from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';
import { useDispatch } from 'app/types/store';

import { ALERTMANAGER_PROVIDED_ENTITY_TAGS, alertmanagerApi } from '../../api/alertmanagerApi';
import { CONFIG_SINGLETON_NAME, configApi } from '../../api/configApi';
import { dataSourcesApi } from '../../api/dataSourcesApi';
import { isNotFoundError } from '../../api/util';
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
   * nothing (404 before the worker's first tick, or the query was skipped), which `isLoading` alone
   * cannot express. Gate write affordances on this.
   */
  isReady: boolean;
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
  const { currentData: configResource, isLoading: isLoadingConfig } = configApi.useGetConfigQuery(
    flagOn && canReadConfig ? { name: CONFIG_SINGLETON_NAME } : skipToken,
    // A 404 means the sync worker has not seeded the singleton yet, and RTKQ caches that rejection with nothing to retry it. Refetching gives a recovery path without reload
    { refetchOnMountOrArgChange: true }
  );
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

  const notifyNotReady = () =>
    notify.error(
      t('alerting.settings.auto-sync.not-ready-title', 'Auto-sync is still initializing'),
      t(
        'alerting.settings.auto-sync.not-ready-body',
        'Grafana has not finished setting up auto-sync for this organization. Try again in a moment.'
      )
    );

  const persist = async (uid: string): Promise<boolean> => {
    // Humans cannot create the singleton — create is denied to non-service identities, and a PUT to
    // a missing object is re-authorized as create — so until the sync worker seeds it on its first
    // tick there is nothing to write into.
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
    isReady: Boolean(configResource),
  };
}

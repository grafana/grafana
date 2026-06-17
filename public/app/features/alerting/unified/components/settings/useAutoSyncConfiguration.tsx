import { useMemo, useState } from 'react';

import { type DataSourceSettings } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useAppNotification } from 'app/core/copy/appNotification';
import {
  type AlertManagerDataSourceJsonData,
  AlertManagerImplementation,
} from 'app/plugins/datasource/alertmanager/types';

import { alertmanagerApi } from '../../api/alertmanagerApi';
import { dataSourcesApi } from '../../api/dataSourcesApi';
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
  save: () => Promise<void>;
  disableSync: () => Promise<void>;
  isPending: boolean;
  isLoading: boolean;
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
  const { currentData: configuration, isLoading: isLoadingConfig } =
    alertmanagerApi.endpoints.getGrafanaAlertingConfiguration.useQuery();
  const { currentData: allDatasources, isLoading: isLoadingDatasources } =
    dataSourcesApi.endpoints.getAllDataSourceSettings.useQuery(undefined, {
      refetchOnMountOrArgChange: true,
    });
  const [updateConfiguration, updateConfigurationState] =
    alertmanagerApi.endpoints.updateGrafanaAlertingConfiguration.useMutation();

  const [operatorManagedUid, setOperatorManagedUid] = useState<string | null>(null);

  const mimirCortexDatasources = useMemo(
    () => (allDatasources ?? []).filter(isAlertmanagerDataSource).filter(isMimirOrCortex),
    [allDatasources]
  );

  const configuredUid = configuration?.external_alertmanager_uid ?? '';
  const hasMatchingDatasource = mimirCortexDatasources.some((ds) => ds.uid === configuredUid);

  // Track user-edited selection separately from the saved value so a background refetch
  // doesn't overwrite an in-flight choice. Null means "follow the saved value".
  const [selectedOverride, setSelectedOverride] = useState<string | null>(null);
  const selectedUid = selectedOverride ?? configuredUid;

  const state: AutoSyncState = useMemo(() => {
    if (configuredUid && operatorManagedUid === configuredUid) {
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
  }, [operatorManagedUid, configuredUid, hasMatchingDatasource, mimirCortexDatasources.length]);

  const notify = useAppNotification();

  const persist = async (uid: string) => {
    try {
      await updateConfiguration({
        external_alertmanager_uid: uid,
        notificationOptions: { showErrorAlert: false },
      }).unwrap();
      notify.success(
        uid
          ? t('alerting.settings.auto-sync.save-success', 'Mimir Alertmanager auto-sync enabled')
          : t('alerting.settings.auto-sync.disable-success', 'Mimir Alertmanager auto-sync disabled')
      );
      setSelectedOverride(null);
    } catch (err) {
      // 409 means the operator-level ini key is authoritative for this org; the request will
      // never succeed via the UI, and the user needs to be told via the operator-managed state.
      if (isStatusCode(err, 409)) {
        setOperatorManagedUid(configuredUid || uid);
        return;
      }
      notify.error(
        t('alerting.settings.auto-sync.save-error', 'Failed to save Mimir Alertmanager auto-sync'),
        stringifyErrorLike(err)
      );
    }
  };

  return {
    state,
    mimirCortexDatasources,
    selectedUid,
    setSelectedUid: (uid: string) => setSelectedOverride(uid),
    save: () => persist(selectedUid),
    // Backend convention: empty string clears the configured UID.
    disableSync: () => persist(''),
    isPending: updateConfigurationState.isLoading,
    isLoading: isLoadingConfig || isLoadingDatasources,
  };
}

function isStatusCode(err: unknown, status: number): boolean {
  return typeof err === 'object' && err !== null && 'status' in err && err.status === status;
}

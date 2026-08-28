// Pure derivations over the org's Config singleton, shared by the two auto-sync hooks.
import { type Config, type ConfigStatus } from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';
import { type DataSourceSettings } from '@grafana/data';
import { t } from '@grafana/i18n';
import { isFetchError } from '@grafana/runtime';
import {
  type AlertManagerDataSourceJsonData,
  AlertManagerImplementation,
} from 'app/plugins/datasource/alertmanager/types';

import { isNotFoundError } from '../api/util';

import { isAlertmanagerDataSource } from './datasource';
import { stringifyErrorLike } from './misc';

export type AutoSyncState =
  | { kind: 'unconfigured' }
  | { kind: 'configured'; uid: string }
  | { kind: 'operator-managed'; uid: string }
  | { kind: 'no-datasources' }
  | { kind: 'orphan-uid'; uid: string };

export interface AutoSyncSource {
  /** '' when sync is not configured. */
  uid: string;
  /** True when the UID comes from grafana.ini, which makes it read-only here. Implies a non-empty `uid`. */
  isIniManaged: boolean;
}

type AlertmanagerDataSource = DataSourceSettings<AlertManagerDataSourceJsonData>;

const MIMIR_CORTEX_IMPLEMENTATIONS: AlertManagerImplementation[] = [
  AlertManagerImplementation.mimir,
  AlertManagerImplementation.cortex,
];

export const SYNCED_CONDITION_TYPE = 'ExternalAlertmanagerSynced';
export const SYNC_REASON_NOT_CONFIGURED = 'NotConfigured';

export function hasConfiguredUid(state: AutoSyncState): state is Extract<AutoSyncState, { uid: string }> {
  return state.kind === 'configured' || state.kind === 'orphan-uid' || state.kind === 'operator-managed';
}

export function isOperatorManaged(state: AutoSyncState): state is Extract<AutoSyncState, { kind: 'operator-managed' }> {
  return state.kind === 'operator-managed';
}

export function filterMimirCortexDatasources(datasources: DataSourceSettings[] = []): AlertmanagerDataSource[] {
  return datasources.filter(isAlertmanagerDataSource).filter((ds) => {
    const impl = ds.jsonData?.implementation ?? AlertManagerImplementation.mimir;
    return MIMIR_CORTEX_IMPLEMENTATIONS.includes(impl);
  });
}

// The syncer keeps the last ini attempt in status after the key is removed, so the condition — not
// the origin — is what says sync is still operator-owned.
function isIniAuthoritative(status: ConfigStatus | undefined): boolean {
  const syncedReason = status?.conditions?.find((c) => c.type === SYNCED_CONDITION_TYPE)?.reason;
  return status?.externalAlertmanagerSync?.origin === 'ini' && syncedReason !== SYNC_REASON_NOT_CONFIGURED;
}

/**
 * spec holds the desired configuration and is authoritative for API-managed orgs; status only records
 * the last attempt and lags. An operator-configured (ini) sync is the exception: spec is dormant
 * there, so status is the only surface.
 */
export function deriveSyncSource(configResource: Config | undefined): AutoSyncSource {
  const status = configResource?.status;
  const iniUid = isIniAuthoritative(status) ? status?.externalAlertmanagerSync?.datasourceUid : undefined;

  if (iniUid) {
    return { uid: iniUid, isIniManaged: true };
  }
  return { uid: configResource?.spec?.externalAlertmanagerSync?.datasourceUid ?? '', isIniManaged: false };
}

export function deriveAutoSyncState(
  source: AutoSyncSource,
  mimirCortexDatasources: AlertmanagerDataSource[]
): AutoSyncState {
  const { uid, isIniManaged } = source;

  if (isIniManaged) {
    return { kind: 'operator-managed', uid };
  }
  if (uid && mimirCortexDatasources.some((ds) => ds.uid === uid)) {
    return { kind: 'configured', uid };
  }
  if (uid) {
    return { kind: 'orphan-uid', uid };
  }
  if (mimirCortexDatasources.length === 0) {
    return { kind: 'no-datasources' };
  }
  return { kind: 'unconfigured' };
}

export interface AutoSyncReadiness {
  /** Whether a write can land: humans cannot create the Config singleton, so it has to exist already. */
  isReady: boolean;
  /** Copy for a false `isReady`, to render next to the affordance it disabled. */
  notReadyMessage?: string;
  /** Set only for a read failure other than the expected pre-seed 404. */
  readErrorMessage?: string;
  readErrorStatus?: string;
}

export function deriveReadiness(configResource: Config | undefined, configError: unknown): AutoSyncReadiness {
  const isReady = Boolean(configResource);
  // A 404 is the pre-seed state, which polling clears. Anything else has to be told to the user,
  // because the k8s base query raises no error alert of its own.
  const readErrorMessage = configError && !isNotFoundError(configError) ? stringifyErrorLike(configError) : undefined;
  const readErrorStatus = isFetchError(configError) ? String(configError.status) : undefined;

  return {
    isReady,
    notReadyMessage: isReady ? undefined : getNotReadyMessage(readErrorMessage),
    readErrorMessage,
    readErrorStatus,
  };
}

export function autoSyncInitializingMessage(): string {
  return t(
    'alerting.settings.auto-sync.not-ready-body',
    'Grafana has not finished setting up auto-sync for this organization. Try again in a moment.'
  );
}

// `{{-error}}`, not `{{error}}`: apimachinery messages quote the resource name, and i18next escapes
// interpolated values by default.
function getNotReadyMessage(readErrorMessage: string | undefined): string {
  if (readErrorMessage) {
    return t(
      'alerting.settings.auto-sync.read-error-message',
      'Could not load the auto-sync configuration: {{-error}}',
      { error: readErrorMessage }
    );
  }
  return autoSyncInitializingMessage();
}

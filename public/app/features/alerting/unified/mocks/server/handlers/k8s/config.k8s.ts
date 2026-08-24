import { HttpResponse, http } from 'msw';
import { type SetupServer } from 'msw/node';

import {
  API_GROUP,
  API_VERSION,
  type Config,
  type ConfigStatus,
} from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';

// Config is the one notifications resource that only exists in v0alpha1, so this route is built from
// that version's own constants rather than the shared ALERTING_API_SERVER_BASE_URL, which points at v1beta1.
const CONFIG_URL = `/apis/${API_GROUP}/${API_VERSION}/namespaces/:namespace/configs/:name`;

interface AutoSyncConfigOptions {
  /**
   * UID on spec.externalAlertmanagerSync — the desired configuration, and the field
   * `useIsAutoSyncActive` reads. Set it to simulate an active sync; omit it for an inactive sync.
   */
  specUid?: string;
  /**
   * UID on status.externalAlertmanagerSync — the last sync attempt, which can lag spec.
   * `useIsAutoSyncActive` does NOT read this at the default `api` origin; set it (with specUid
   * omitted) to simulate a stale status that must not be treated as an active sync.
   */
  statusUid?: string;
  /**
   * Which source supplied `statusUid` on the last run. `ini` is the operator override, which never
   * reaches spec, so status is the only place it surfaces.
   */
  statusOrigin?: 'api' | 'ini';
  /**
   * Reason on the ExternalAlertmanagerSynced condition. `NotConfigured` is how the syncer reports
   * that sync stopped while keeping externalAlertmanagerSync as last-attempt context.
   */
  syncedReason?: 'SyncSucceeded' | 'MergeCommitted' | 'NotConfigured';
}

function buildStatus({ statusUid, statusOrigin = 'api', syncedReason }: AutoSyncConfigOptions): ConfigStatus {
  const status: ConfigStatus = {};

  if (statusUid) {
    status.externalAlertmanagerSync = { datasourceUid: statusUid, origin: statusOrigin };
  }
  if (syncedReason) {
    status.conditions = [
      {
        type: 'ExternalAlertmanagerSynced',
        // The syncer only reports Unknown for NotConfigured; the other reasons ride a successful tick.
        status: syncedReason === 'NotConfigured' ? 'Unknown' : 'True',
        reason: syncedReason,
        lastTransitionTime: '2026-01-01T00:00:00Z',
      },
    ];
  }
  return status;
}

function buildConfig(name: string, options: AutoSyncConfigOptions = {}): Config {
  return {
    apiVersion: `${API_GROUP}/${API_VERSION}`,
    kind: 'Config',
    metadata: { name },
    spec: options.specUid ? { externalAlertmanagerSync: { datasourceUid: options.specUid } } : {},
    status: buildStatus(options),
  };
}

const configHandler = (options: AutoSyncConfigOptions = {}, onRequest?: () => void) =>
  http.get<{ namespace: string; name: string }>(CONFIG_URL, ({ params }) => {
    onRequest?.();
    return HttpResponse.json(buildConfig(params.name, options));
  });

/**
 * Override the Config GET to drive external Alertmanager auto-sync state. Pass `specUid` to
 * simulate an active sync (what `useIsAutoSyncActive` reads); omit it for an inactive, empty Config.
 * Pass `statusUid` alone to simulate a stale status that must not count as active, or with
 * `statusOrigin: 'ini'` to simulate the operator override that only ever surfaces in status.
 *
 * Returns a `requestSpy` that fires on every GET, so a test can assert the query was — or, when a
 * permission gate should short-circuit it, was not — made.
 */
export function setupAutoSyncConfig(server: SetupServer, options: AutoSyncConfigOptions = {}) {
  const requestSpy = jest.fn();
  server.use(configHandler(options, requestSpy));
  return { requestSpy };
}

const handlers = [configHandler()];
export default handlers;

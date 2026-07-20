import { HttpResponse, http } from 'msw';
import { type SetupServer } from 'msw/node';

import { API_GROUP, API_VERSION, type Config } from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';
import { ALERTING_API_SERVER_BASE_URL } from 'app/features/alerting/unified/mocks/server/utils';

const CONFIG_URL = `${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/configs/:name`;

interface AutoSyncConfigOptions {
  /**
   * UID on spec.externalAlertmanagerSync — the desired configuration, and the field
   * `useIsAutoSyncActive` reads. Set it to simulate an active sync; omit it for an inactive sync.
   */
  specUid?: string;
  /**
   * UID on status.externalAlertmanagerSync — the last sync attempt, which can lag spec.
   * `useIsAutoSyncActive` does NOT read this; set it (with specUid omitted) to simulate a stale
   * status that must not be treated as an active sync.
   */
  statusUid?: string;
}

function buildConfig(name: string, { specUid, statusUid }: AutoSyncConfigOptions = {}): Config {
  return {
    apiVersion: `${API_GROUP}/${API_VERSION}`,
    kind: 'Config',
    metadata: { name },
    spec: specUid ? { externalAlertmanagerSync: { datasourceUid: specUid } } : {},
    status: statusUid ? { externalAlertmanagerSync: { datasourceUid: statusUid, origin: 'api' } } : {},
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
 * Pass `statusUid` alone to simulate a stale status that must not count as active.
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

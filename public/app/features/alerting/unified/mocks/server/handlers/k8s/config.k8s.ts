import { HttpResponse, http } from 'msw';
import { type SetupServer } from 'msw/node';

import {
  API_GROUP,
  API_VERSION,
  type Config,
  type ConfigCondition,
} from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';
import { CONFIG_SINGLETON_NAME } from 'app/features/alerting/unified/api/configApi';
import { SYNCED_CONDITION_TYPE, SYNC_REASON_NOT_CONFIGURED } from 'app/features/alerting/unified/utils/autoSync';

// Config is the one notifications resource that only exists in v0alpha1, so this route is built from
// that version's own constants rather than the shared ALERTING_API_SERVER_BASE_URL, which points at v1beta1.
const CONFIG_URL = `/apis/${API_GROUP}/${API_VERSION}/namespaces/:namespace/configs/:name`;

/** The subset of the worker's condition reasons tests need so far. */
type SyncedConditionReason = typeof SYNC_REASON_NOT_CONFIGURED | 'SyncSucceeded' | 'MimirFetchFailed';

const CONDITION_STATUS_BY_REASON: Record<SyncedConditionReason, ConfigCondition['status']> = {
  SyncSucceeded: 'True',
  NotConfigured: 'Unknown',
  MimirFetchFailed: 'False',
};

interface AutoSyncConfigOptions {
  /** spec.externalAlertmanagerSync — the desired configuration. */
  specUid?: string;
  /** status.externalAlertmanagerSync — the last attempt, which lags spec. */
  statusUid?: string;
  /** 'ini' marks the org as operator-managed: the grafana.ini key wins and spec is dormant. */
  origin?: 'api' | 'ini';
  /**
   * Defaults to what the worker would write for the other options. Pass 'NotConfigured' with
   * `origin: 'ini'` for an org whose ini key was removed: the stale status stays, the reason moves on.
   */
  syncedReason?: SyncedConditionReason;
}

function buildAutoSyncConfig(name: string, options: AutoSyncConfigOptions = {}): Config {
  const { specUid, statusUid, origin = 'api' } = options;
  const syncedReason = options.syncedReason ?? (statusUid ? 'SyncSucceeded' : SYNC_REASON_NOT_CONFIGURED);
  return {
    apiVersion: `${API_GROUP}/${API_VERSION}`,
    kind: 'Config',
    metadata: { name, namespace: 'default', resourceVersion: '1' },
    spec: specUid ? { externalAlertmanagerSync: { datasourceUid: specUid } } : {},
    status: {
      // The worker writes it every tick, so a seeded singleton always has this condition.
      conditions: [
        {
          type: SYNCED_CONDITION_TYPE,
          status: CONDITION_STATUS_BY_REASON[syncedReason],
          reason: syncedReason,
          lastTransitionTime: '2026-01-01T00:00:00Z',
        },
      ],
      ...(statusUid ? { externalAlertmanagerSync: { datasourceUid: statusUid, origin } } : {}),
    },
  };
}

function notFoundStatus() {
  return {
    kind: 'Status',
    apiVersion: 'v1',
    metadata: {},
    status: 'Failure',
    message: `configs.notifications.alerting.grafana.app "${CONFIG_SINGLETON_NAME}" not found`,
    reason: 'NotFound',
    code: 404,
  };
}

const configHandler = (options: AutoSyncConfigOptions = {}, onRequest?: () => void) =>
  http.get<{ namespace: string; name: string }>(CONFIG_URL, ({ params }) => {
    onRequest?.();
    return HttpResponse.json(buildAutoSyncConfig(params.name, options));
  });

/**
 * Override the Config GET to drive external Alertmanager auto-sync state — see
 * `AutoSyncConfigOptions`. The returned `requestSpy` fires on every GET, so a test can assert the
 * query was, or was not, made.
 */
export function setupAutoSyncConfig(server: SetupServer, options: AutoSyncConfigOptions = {}) {
  const requestSpy = jest.fn();
  server.use(configHandler(options, requestSpy));
  return { requestSpy };
}

/** 404 on both read and write: the sync worker has not seeded the singleton yet. */
export function setupAutoSyncConfigAbsent(server: SetupServer) {
  const requestSpy = jest.fn();
  server.use(
    http.get<{ namespace: string; name: string }>(CONFIG_URL, () => {
      requestSpy();
      return HttpResponse.json(notFoundStatus(), { status: 404 });
    }),
    http.patch<{ namespace: string; name: string }>(CONFIG_URL, () =>
      HttpResponse.json(notFoundStatus(), { status: 404 })
    )
  );
  return { requestSpy };
}

/** Quotes the resource name on purpose: they catch i18next escaping the interpolated message. */
export const CONFIG_READ_FAILURE_MESSAGE =
  'Internal error occurred: failed to read config "default": etcdserver: request timed out';

/**
 * Fail the Config GET with something other than a 404 — no amount of waiting fixes it. The
 * `requestSpy` lets a test installing this mid-flight confirm the failing read landed.
 */
export function setupAutoSyncConfigReadError(
  server: SetupServer,
  { code, message = CONFIG_READ_FAILURE_MESSAGE }: { code: number; message?: string }
) {
  const requestSpy = jest.fn();
  server.use(
    http.get<{ namespace: string; name: string }>(CONFIG_URL, () => {
      requestSpy();
      return HttpResponse.json(
        { kind: 'Status', apiVersion: 'v1', metadata: {}, status: 'Failure', reason: 'InternalError', code, message },
        { status: code }
      );
    })
  );
  return { requestSpy };
}

/** A single JSON Patch operation, as the UI sends them. */
interface PatchOperation {
  op: string;
  path: string;
  value?: unknown;
}

/**
 * Stateful Config handlers: PATCH applies to the stored object and GET serves it, so a refetch
 * observes the saved UID. Every write bumps `metadata.resourceVersion`, as a real apiserver does —
 * the UI must not pin it, since the worker bumps it every tick too.
 */
export function setupStatefulAutoSyncConfig(server: SetupServer, options: AutoSyncConfigOptions = {}) {
  let stored = buildAutoSyncConfig(CONFIG_SINGLETON_NAME, options);
  const patchSpy = jest.fn();

  server.use(
    http.get<{ namespace: string; name: string }>(CONFIG_URL, () => HttpResponse.json(stored)),
    http.patch<{ namespace: string; name: string }, PatchOperation[]>(CONFIG_URL, async ({ request }) => {
      const operations = await request.json();
      patchSpy(operations);

      let spec = stored.spec;
      for (const operation of operations) {
        if (operation.path === '/spec/externalAlertmanagerSync') {
          spec = { ...spec, externalAlertmanagerSync: operation.value as Config['spec']['externalAlertmanagerSync'] };
        }
      }

      const nextVersion = String(Number(stored.metadata.resourceVersion ?? '1') + 1);
      stored = { ...stored, spec, metadata: { ...stored.metadata, resourceVersion: nextVersion } };
      return HttpResponse.json(stored);
    })
  );

  return { patchSpy, getStored: () => stored };
}

/**
 * Make the Config write fail with an apimachinery Status — e.g. the admission rejection an
 * operator-managed org returns when a UID write is attempted.
 */
export function setupAutoSyncConfigWriteError(
  server: SetupServer,
  { code, message }: { code: number; message: string }
) {
  server.use(
    http.patch<{ namespace: string; name: string }>(CONFIG_URL, () =>
      HttpResponse.json(
        { kind: 'Status', apiVersion: 'v1', metadata: {}, status: 'Failure', reason: 'Forbidden', code, message },
        { status: code }
      )
    )
  );
}

const handlers = [configHandler()];
export default handlers;

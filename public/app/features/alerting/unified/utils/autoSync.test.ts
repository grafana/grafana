import { type Config, type ConfigStatus } from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';
import { type DataSourceSettings } from '@grafana/data';
import { AlertManagerImplementation } from 'app/plugins/datasource/alertmanager/types';

import { mimirAlertmanagerDataSourcePayload } from '../mocks/server/configure/datasources';

import {
  type AutoSyncSource,
  SYNCED_CONDITION_TYPE,
  SYNC_REASON_NOT_CONFIGURED,
  deriveAutoSyncState,
  deriveReadiness,
  deriveSyncSource,
  filterMimirCortexDatasources,
} from './autoSync';
import { DataSourceType } from './datasource';

const MIMIR_UID = 'mimir-uid';
const CORTEX_UID = 'cortex-uid';

function buildConfig({ specUid, status }: { specUid?: string; status?: ConfigStatus } = {}): Config {
  return {
    apiVersion: 'notifications.alerting.grafana.app/v0alpha1',
    kind: 'Config',
    metadata: { name: 'default', namespace: 'default' },
    spec: specUid ? { externalAlertmanagerSync: { datasourceUid: specUid } } : {},
    status,
  };
}

function syncedStatus({ uid, origin, reason }: { uid?: string; origin?: 'api' | 'ini'; reason: string }): ConfigStatus {
  return {
    conditions: [
      {
        type: SYNCED_CONDITION_TYPE,
        status: reason === SYNC_REASON_NOT_CONFIGURED ? 'Unknown' : 'True',
        reason,
        lastTransitionTime: '2026-01-01T00:00:00Z',
      },
    ],
    ...(uid ? { externalAlertmanagerSync: { datasourceUid: uid, origin } } : {}),
  };
}

const MIMIR_DS = mimirAlertmanagerDataSourcePayload({ uid: MIMIR_UID });
const CORTEX_DS = mimirAlertmanagerDataSourcePayload({
  uid: CORTEX_UID,
  jsonData: { implementation: AlertManagerImplementation.cortex },
});
/** Alertmanager datasources default to Mimir when no implementation is set. */
const IMPLICIT_MIMIR_DS = mimirAlertmanagerDataSourcePayload({ uid: 'implicit-uid', jsonData: {} });
const VANILLA_DS = mimirAlertmanagerDataSourcePayload({
  uid: 'vanilla-uid',
  jsonData: { implementation: AlertManagerImplementation.prometheus },
});
const LOKI_DS = mimirAlertmanagerDataSourcePayload({ uid: 'loki-uid', type: DataSourceType.Loki });

/** The apimachinery Status shape a failed k8s read actually arrives in. */
function apiMachineryError(code: number, message: string) {
  return {
    status: code,
    data: { kind: 'Status', apiVersion: 'v1', metadata: {}, status: 'Failure', code, message },
    config: { url: '/apis/notifications.alerting.grafana.app/v0alpha1/namespaces/default/configs/default' },
  };
}

describe('deriveSyncSource', () => {
  it('reads the UID from spec for an API-managed org', () => {
    const source = deriveSyncSource(buildConfig({ specUid: MIMIR_UID }));
    expect(source).toEqual({ uid: MIMIR_UID, isIniManaged: false });
  });

  it('ignores a stale status UID when spec is empty', () => {
    const source = deriveSyncSource(
      buildConfig({ status: syncedStatus({ uid: MIMIR_UID, origin: 'api', reason: 'SyncSucceeded' }) })
    );
    expect(source).toEqual({ uid: '', isIniManaged: false });
  });

  it('reads the UID from status for an operator-configured (ini) sync', () => {
    // spec is dormant for those orgs, so status is the only surface.
    const source = deriveSyncSource(
      buildConfig({ status: syncedStatus({ uid: MIMIR_UID, origin: 'ini', reason: 'SyncSucceeded' }) })
    );
    expect(source).toEqual({ uid: MIMIR_UID, isIniManaged: true });
  });

  it('ignores an ini status the worker has stopped resolving, so a removed key can be recovered from', () => {
    // Regression: the stale ini status locked the card as operator-managed — no picker, no Save, no
    // Disable — and kept imports blocked, with no way out.
    const source = deriveSyncSource(
      buildConfig({ status: syncedStatus({ uid: MIMIR_UID, origin: 'ini', reason: 'NotConfigured' }) })
    );
    expect(source).toEqual({ uid: '', isIniManaged: false });
  });

  it('falls back to spec when a stale ini status is no longer configured', () => {
    // The admin removed the ini key, then configured sync from the UI: spec is authoritative again.
    const source = deriveSyncSource(
      buildConfig({
        specUid: CORTEX_UID,
        status: syncedStatus({ uid: MIMIR_UID, origin: 'ini', reason: 'NotConfigured' }),
      })
    );
    expect(source).toEqual({ uid: CORTEX_UID, isIniManaged: false });
  });

  it('keeps ini authoritative over spec while the org is still operator-managed', () => {
    // The ini key wins in the backend resolver, and admission rejects spec writes while it is set.
    const source = deriveSyncSource(
      buildConfig({
        specUid: CORTEX_UID,
        status: syncedStatus({ uid: MIMIR_UID, origin: 'ini', reason: 'SyncSucceeded' }),
      })
    );
    expect(source).toEqual({ uid: MIMIR_UID, isIniManaged: true });
  });

  it('still trusts an ini status whose last sync attempt failed', () => {
    // A failing sync is still a configured one — only NotConfigured means the worker resolved no UID.
    const source = deriveSyncSource(
      buildConfig({ status: syncedStatus({ uid: MIMIR_UID, origin: 'ini', reason: 'MimirFetchFailed' }) })
    );
    expect(source).toEqual({ uid: MIMIR_UID, isIniManaged: true });
  });

  it('trusts an ini status that carries no condition yet', () => {
    // The worker writes the condition alongside the UID, so its absence is not "not configured".
    const source = deriveSyncSource(
      buildConfig({ status: { externalAlertmanagerSync: { datasourceUid: MIMIR_UID, origin: 'ini' } } })
    );
    expect(source).toEqual({ uid: MIMIR_UID, isIniManaged: true });
  });

  it('does not let an ini origin with no UID hide a spec UID', () => {
    const source = deriveSyncSource(
      buildConfig({
        specUid: CORTEX_UID,
        status: {
          ...syncedStatus({ reason: 'SyncSucceeded' }),
          externalAlertmanagerSync: { datasourceUid: '', origin: 'ini' },
        },
      })
    );
    expect(source).toEqual({ uid: CORTEX_UID, isIniManaged: false });
  });

  it('reports no source with no Config at all', () => {
    // Loading, an unseeded 404, a 403, or a skipped query all land here: fail open.
    expect(deriveSyncSource(undefined)).toEqual({ uid: '', isIniManaged: false });
  });
});

describe('deriveAutoSyncState', () => {
  const mimirCortex = filterMimirCortexDatasources([MIMIR_DS, CORTEX_DS]);

  const cases: Array<[string, AutoSyncSource, DataSourceSettings[], ReturnType<typeof deriveAutoSyncState>]> = [
    ['no UID with datasources available', { uid: '', isIniManaged: false }, mimirCortex, { kind: 'unconfigured' }],
    ['no UID and no datasources', { uid: '', isIniManaged: false }, [], { kind: 'no-datasources' }],
    [
      'UID matching a known datasource',
      { uid: MIMIR_UID, isIniManaged: false },
      mimirCortex,
      { kind: 'configured', uid: MIMIR_UID },
    ],
    [
      'UID matching nothing',
      { uid: 'gone-uid', isIniManaged: false },
      mimirCortex,
      { kind: 'orphan-uid', uid: 'gone-uid' },
    ],
    [
      'UID matching nothing with no datasources at all',
      { uid: 'gone-uid', isIniManaged: false },
      [],
      { kind: 'orphan-uid', uid: 'gone-uid' },
    ],
    [
      'an ini-managed UID',
      { uid: MIMIR_UID, isIniManaged: true },
      mimirCortex,
      { kind: 'operator-managed', uid: MIMIR_UID },
    ],
    [
      // operator-managed outranks orphan-uid: the admin cannot fix the UID from here either way.
      'an ini-managed UID matching nothing',
      { uid: 'gone-uid', isIniManaged: true },
      mimirCortex,
      { kind: 'operator-managed', uid: 'gone-uid' },
    ],
  ];

  it.each(cases)('resolves %s', (_name, source, datasources, expected) => {
    expect(deriveAutoSyncState(source, filterMimirCortexDatasources(datasources))).toEqual(expected);
  });
});

describe('filterMimirCortexDatasources', () => {
  it('keeps Mimir and Cortex Alertmanagers, including the implicit Mimir default', () => {
    const datasources = [MIMIR_DS, CORTEX_DS, IMPLICIT_MIMIR_DS];
    expect(filterMimirCortexDatasources(datasources).map((ds) => ds.uid)).toEqual([
      MIMIR_UID,
      CORTEX_UID,
      IMPLICIT_MIMIR_DS.uid,
    ]);
  });

  it('drops vanilla Alertmanagers and non-Alertmanager datasources', () => {
    expect(filterMimirCortexDatasources([VANILLA_DS, LOKI_DS])).toEqual([]);
  });

  it('handles a missing datasource list', () => {
    expect(filterMimirCortexDatasources()).toEqual([]);
  });
});

describe('deriveReadiness', () => {
  it('is ready once the singleton has been read', () => {
    expect(deriveReadiness(buildConfig({ specUid: MIMIR_UID }), undefined)).toEqual({
      isReady: true,
      notReadyMessage: undefined,
      readErrorMessage: undefined,
      readErrorStatus: undefined,
    });
  });

  it('presents an unseeded singleton (404) as transient, with no error to report', () => {
    const readiness = deriveReadiness(undefined, apiMachineryError(404, 'configs "default" not found'));

    expect(readiness.isReady).toBe(false);
    expect(readiness.notReadyMessage).toBe(
      'Grafana has not finished setting up auto-sync for this organization. Try again in a moment.'
    );
    expect(readiness.readErrorMessage).toBeUndefined();
  });

  it('presents any other failed read as a failure, and reports it', () => {
    const message = 'Internal error occurred: failed to read config "default"';
    const readiness = deriveReadiness(undefined, apiMachineryError(500, message));

    expect(readiness.isReady).toBe(false);
    expect(readiness.notReadyMessage).toBe(`Could not load the auto-sync configuration: ${message}`);
    expect(readiness.readErrorMessage).toBe(message);
    expect(readiness.readErrorStatus).toBe('500');
  });

  it('stays ready when a poll fails after a successful read', () => {
    // RTKQ keeps the last good `currentData`, so a mid-session blip must not disable the page.
    const readiness = deriveReadiness(buildConfig({ specUid: MIMIR_UID }), apiMachineryError(500, 'boom'));

    expect(readiness.isReady).toBe(true);
    expect(readiness.notReadyMessage).toBeUndefined();
    expect(readiness.readErrorMessage).toBe('boom');
  });
});

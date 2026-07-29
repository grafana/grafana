import { act, renderHook, waitFor } from '@testing-library/react';
import { getWrapper, testWithFeatureToggles } from 'test/test-utils';

import { useAppNotification } from 'app/core/copy/appNotification';
import { configureStore } from 'app/store/configureStore';
import { AccessControlAction } from 'app/types/accessControl';

import { logError } from '../../Analytics';
import { ALERTMANAGER_PROVIDED_ENTITY_TAGS, alertmanagerApi } from '../../api/alertmanagerApi';
import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';
import { setupAlertmanagersStatus } from '../../mocks/server/configure/alertmanagers';
import { setupDatasourcesEndpoint } from '../../mocks/server/configure/datasources';
import {
  CONFIG_READ_FAILURE_MESSAGE,
  setupAutoSyncConfig,
  setupAutoSyncConfigAbsent,
  setupAutoSyncConfigReadError,
  setupAutoSyncConfigWriteError,
  setupStatefulAutoSyncConfig,
} from '../../mocks/server/handlers/k8s/config.k8s';
import { MERGE_COMMITTED_REASON } from '../../utils/autoSync';
import { AUTO_SYNC_CONFIG_POLL_INTERVAL_MS } from '../../utils/constants';

import { useAutoSyncConfiguration } from './useAutoSyncConfiguration';

const server = setupMswServer();
const wrapper = () => getWrapper({ renderWithRouter: true });

// The hook reports save failures through app notifications, so that is where the error text has to
// be asserted — it never reaches the DOM from here.
jest.mock('app/core/copy/appNotification');
const notifyError = jest.fn();
const notifySuccess = jest.fn();

// A failed Config read is reported to Faro and nowhere else visible, so the sink has to be spied on.
jest.mock('../../Analytics', () => ({
  ...jest.requireActual('../../Analytics'),
  logError: jest.fn(),
}));
const mockLogError = jest.mocked(logError);

/** The copy the hook uses for a not-ready state that waiting actually resolves. */
const INITIALIZING_MESSAGE =
  'Grafana has not finished setting up auto-sync for this organization. Try again in a moment.';

const MIMIR_DS = {
  id: 1,
  uid: 'mimir-uid',
  orgId: 1,
  name: 'Mimir Alertmanager',
  type: 'alertmanager',
  url: 'http://localhost:9009',
  jsonData: { implementation: 'mimir' },
};

const CORTEX_DS = {
  id: 2,
  uid: 'cortex-uid',
  orgId: 1,
  name: 'Cortex Alertmanager',
  type: 'alertmanager',
  url: 'http://localhost:9010',
  jsonData: { implementation: 'cortex' },
};

const VANILLA_DS = {
  id: 3,
  uid: 'vanilla-uid',
  orgId: 1,
  name: 'Vanilla Alertmanager',
  type: 'alertmanager',
  url: 'http://localhost:9093',
  jsonData: { implementation: 'prometheus' },
};

function renderAutoSyncHook() {
  return renderHook(() => useAutoSyncConfiguration(), { wrapper: wrapper() });
}

/**
 * Renders with an owned store so `dispatch` can be spied on. Spying on
 * `alertmanagerApi.util.invalidateTags` itself is not viable — RTKQ's middleware calls `.match()` on
 * the action creator, which a plain jest mock does not have.
 */
function renderAutoSyncHookWithDispatchSpy() {
  const store = configureStore();
  const dispatchSpy = jest.spyOn(store, 'dispatch');
  const view = renderHook(() => useAutoSyncConfiguration(), {
    wrapper: getWrapper({ store, renderWithRouter: true }),
  });
  return { ...view, dispatchSpy };
}

function invalidatedTagSets(dispatchSpy: jest.SpyInstance) {
  return dispatchSpy.mock.calls
    .map(([action]) => action)
    .filter((action) => alertmanagerApi.util.invalidateTags.match(action))
    .map((action) => action.payload);
}

testWithFeatureToggles({ enable: ['alerting.syncExternalAlertmanager'] });

beforeEach(() => {
  notifyError.mockClear();
  notifySuccess.mockClear();
  mockLogError.mockClear();
  jest.mocked(useAppNotification).mockReturnValue({
    success: notifySuccess,
    error: notifyError,
    warning: jest.fn(),
    info: jest.fn(),
  });
  grantUserPermissions([AccessControlAction.ActionAlertingNotificationsConfigRead]);
  setupAlertmanagersStatus(server);
});

// Only the polling test fakes timers; leaving them faked would stall every test after it.
afterEach(() => {
  jest.useRealTimers();
});

describe('useAutoSyncConfiguration — state resolution', () => {
  it('returns `unconfigured` when no UID and Mimir/Cortex datasources exist', async () => {
    setupAutoSyncConfig(server);
    setupDatasourcesEndpoint(server, [MIMIR_DS]);

    const { result } = renderAutoSyncHook();
    await waitFor(() => expect(result.current.state.kind).toBe('unconfigured'));
  });

  it('returns `configured` when spec UID matches a known Mimir datasource', async () => {
    setupAutoSyncConfig(server, { specUid: 'mimir-uid' });
    setupDatasourcesEndpoint(server, [MIMIR_DS]);

    const { result } = renderAutoSyncHook();
    await waitFor(() => expect(result.current.state).toEqual({ kind: 'configured', uid: 'mimir-uid' }));
  });

  it('returns `configured` when spec UID matches a Cortex datasource', async () => {
    setupAutoSyncConfig(server, { specUid: 'cortex-uid' });
    setupDatasourcesEndpoint(server, [CORTEX_DS]);

    const { result } = renderAutoSyncHook();
    await waitFor(() => expect(result.current.state).toEqual({ kind: 'configured', uid: 'cortex-uid' }));
  });

  it('returns `orphan-uid` when configured UID does not match any known datasource', async () => {
    setupAutoSyncConfig(server, { specUid: 'missing-uid' });
    setupDatasourcesEndpoint(server, [MIMIR_DS]);

    const { result } = renderAutoSyncHook();
    await waitFor(() => expect(result.current.state).toEqual({ kind: 'orphan-uid', uid: 'missing-uid' }));
  });

  it('returns `orphan-uid` (not `no-datasources`) when configured UID is set but no datasources exist', async () => {
    setupAutoSyncConfig(server, { specUid: 'missing-uid' });
    setupDatasourcesEndpoint(server, []);

    const { result } = renderAutoSyncHook();
    await waitFor(() => expect(result.current.state).toEqual({ kind: 'orphan-uid', uid: 'missing-uid' }));
  });

  it('returns `no-datasources` when no Mimir/Cortex datasources exist and no UID configured', async () => {
    setupAutoSyncConfig(server);
    setupDatasourcesEndpoint(server, [VANILLA_DS]);

    const { result } = renderAutoSyncHook();
    await waitFor(() => expect(result.current.state.kind).toBe('no-datasources'));
  });

  it('treats a Vanilla (prometheus) Alertmanager datasource as not a Mimir/Cortex source', async () => {
    setupAutoSyncConfig(server);
    setupDatasourcesEndpoint(server, [VANILLA_DS]);

    const { result } = renderAutoSyncHook();
    await waitFor(() => expect(result.current.state.kind).toBe('no-datasources'));
    expect(result.current.mimirCortexDatasources).toHaveLength(0);
  });

  it('treats an unseeded singleton (404) as unconfigured', async () => {
    // Humans cannot create the singleton; the sync worker seeds it on its first tick.
    setupAutoSyncConfigAbsent(server);
    setupDatasourcesEndpoint(server, [MIMIR_DS]);

    const { result } = renderAutoSyncHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.state).toEqual({ kind: 'unconfigured' });
  });

  it('ignores a stale status UID when spec is empty', async () => {
    // status lags spec and stays populated after sync is disabled; spec is the desired configuration.
    setupAutoSyncConfig(server, { statusUid: 'mimir-uid' });
    setupDatasourcesEndpoint(server, [MIMIR_DS]);

    const { result } = renderAutoSyncHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.state).toEqual({ kind: 'unconfigured' });
  });

  it('returns `operator-managed` when status origin is ini', async () => {
    // Detected on read, before any save is attempted — the legacy API only revealed this via a 409.
    setupAutoSyncConfig(server, { statusUid: 'mimir-uid', origin: 'ini' });
    setupDatasourcesEndpoint(server, [MIMIR_DS]);

    const { result } = renderAutoSyncHook();
    await waitFor(() => expect(result.current.state).toEqual({ kind: 'operator-managed', uid: 'mimir-uid' }));
  });

  it('stays `operator-managed` across re-renders', async () => {
    setupAutoSyncConfig(server, { statusUid: 'mimir-uid', origin: 'ini' });
    setupDatasourcesEndpoint(server, [MIMIR_DS]);

    const { result, rerender } = renderAutoSyncHook();
    await waitFor(() => expect(result.current.state.kind).toBe('operator-managed'));

    rerender();
    expect(result.current.state.kind).toBe('operator-managed');
  });

  it('drops `operator-managed` once the worker stops resolving a removed ini key', async () => {
    // Regression: `operator-managed` offers no picker, no Save and no Disable, so a stale ini status
    // stranded the admin in the exact state the callout tells them to leave.
    setupAutoSyncConfig(server, { statusUid: 'mimir-uid', origin: 'ini', syncedReason: 'NotConfigured' });
    setupDatasourcesEndpoint(server, [MIMIR_DS]);

    const { result } = renderAutoSyncHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.state).toEqual({ kind: 'unconfigured' });
  });

  it('skips the Config query without the read permission', async () => {
    grantUserPermissions([]);
    const { requestSpy } = setupAutoSyncConfig(server, { specUid: 'mimir-uid' });
    setupDatasourcesEndpoint(server, [MIMIR_DS]);

    const { result } = renderAutoSyncHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(requestSpy).not.toHaveBeenCalled();
    expect(result.current.state.kind).toBe('unconfigured');
    // Nothing was read, so there is nothing to write into either.
    expect(result.current.isReady).toBe(false);
  });
});

describe('useAutoSyncConfiguration — not-ready reason', () => {
  it('presents an unseeded singleton as transient', async () => {
    setupAutoSyncConfigAbsent(server);
    setupDatasourcesEndpoint(server, [MIMIR_DS]);

    const { result } = renderAutoSyncHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isReady).toBe(false);
    expect(result.current.notReadyMessage).toBe(INITIALIZING_MESSAGE);
  });

  it('presents a failed read as a failure, not as initialization', async () => {
    // Waiting does not fix a 500, and the k8s base query raises no error alert of its own, so this
    // message is the only signal the admin gets.
    setupAutoSyncConfigReadError(server, { code: 500 });
    setupDatasourcesEndpoint(server, [MIMIR_DS]);

    const { result } = renderAutoSyncHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isReady).toBe(false);
    expect(result.current.notReadyMessage).toBe(
      `Could not load the auto-sync configuration: ${CONFIG_READ_FAILURE_MESSAGE}`
    );
  });

  it('reports a failed read to Faro once per distinct failure, not on every poll tick', async () => {
    // Faro is the only trace this leaves besides a tooltip nobody has to hover, so a broken read left
    // polling for an hour must not push 120 identical logs.
    jest.useFakeTimers();
    setupAutoSyncConfigReadError(server, { code: 500 });
    setupDatasourcesEndpoint(server, [MIMIR_DS]);

    const { result } = renderAutoSyncHook();
    await waitFor(() => expect(result.current.notReadyMessage).toContain(CONFIG_READ_FAILURE_MESSAGE));

    expect(mockLogError).toHaveBeenCalledWith(expect.objectContaining({ message: CONFIG_READ_FAILURE_MESSAGE }), {
      operation: 'getAutoSyncConfig',
      status: '500',
    });
    expect(mockLogError).toHaveBeenCalledTimes(1);

    // The same failure again on the next tick — nothing observable changes, so it cannot be waited on
    // directly.
    setupAutoSyncConfigReadError(server, { code: 500 });
    await act(async () => {
      jest.advanceTimersByTime(AUTO_SYNC_CONFIG_POLL_INTERVAL_MS);
    });

    // A different failure after it. Waiting for this one to surface is the barrier that proves the
    // repeat above was processed, not merely requested — the request spy fires before the store
    // updates, so it cannot carry that weight.
    const OTHER_FAILURE = 'Internal error occurred: dial tcp: lookup apiserver: no such host';
    setupAutoSyncConfigReadError(server, { code: 503, message: OTHER_FAILURE });
    await act(async () => {
      jest.advanceTimersByTime(AUTO_SYNC_CONFIG_POLL_INTERVAL_MS);
    });
    await waitFor(() => expect(result.current.notReadyMessage).toContain(OTHER_FAILURE));

    // Three failing polls, two distinct failures.
    expect(mockLogError).toHaveBeenCalledTimes(2);
  });

  it('reports no reason once the singleton has been read', async () => {
    setupAutoSyncConfig(server, { specUid: 'mimir-uid' });
    setupDatasourcesEndpoint(server, [MIMIR_DS]);

    const { result } = renderAutoSyncHook();
    await waitFor(() => expect(result.current.isReady).toBe(true));

    expect(result.current.notReadyMessage).toBeUndefined();
  });

  it('keeps the page usable when a poll fails after a successful read', async () => {
    // RTKQ retains the last good `currentData` on a rejected refetch, so a mid-session blip must not
    // disable the write affordances or start claiming auto-sync is initializing.
    jest.useFakeTimers();
    setupAutoSyncConfig(server, { specUid: 'mimir-uid' });
    setupDatasourcesEndpoint(server, [MIMIR_DS]);

    const { result } = renderAutoSyncHook();
    await waitFor(() => expect(result.current.isReady).toBe(true));

    const { requestSpy } = setupAutoSyncConfigReadError(server, { code: 500 });
    await act(async () => {
      jest.advanceTimersByTime(AUTO_SYNC_CONFIG_POLL_INTERVAL_MS);
    });
    await waitFor(() => expect(requestSpy).toHaveBeenCalled());

    expect(result.current.isReady).toBe(true);
    expect(result.current.notReadyMessage).toBeUndefined();
    expect(result.current.state).toEqual({ kind: 'configured', uid: 'mimir-uid' });
  });
});

describe('useAutoSyncConfiguration — sync health', () => {
  it('reports healthy when the condition is True for the configured UID', async () => {
    setupAutoSyncConfig(server, {
      specUid: 'mimir-uid',
      statusUid: 'mimir-uid',
      condition: { status: 'True', reason: 'SyncSucceeded' },
    });
    setupDatasourcesEndpoint(server, [MIMIR_DS]);

    const { result } = renderAutoSyncHook();
    await waitFor(() => expect(result.current.syncHealth).toEqual({ kind: 'healthy' }));
  });

  it('reports merge-committed — not healthy — when a True condition carries the terminal MergeCommitted reason', async () => {
    // The worker keeps status True on the terminal merge so the synced-at timestamp survives, so the
    // reason is all that separates a stopped sync from a running one.
    setupAutoSyncConfig(server, {
      specUid: 'mimir-uid',
      statusUid: 'mimir-uid',
      condition: {
        status: 'True',
        reason: MERGE_COMMITTED_REASON,
        message: 'automatic sync from the datasource has stopped',
      },
    });
    setupDatasourcesEndpoint(server, [MIMIR_DS]);

    const { result } = renderAutoSyncHook();
    await waitFor(() => expect(result.current.state.kind).toBe('configured'));
    expect(result.current.syncHealth).toEqual({ kind: 'merge-committed' });
  });

  it('reports failing with the reason and message when the condition is False', async () => {
    setupAutoSyncConfig(server, {
      specUid: 'mimir-uid',
      statusUid: 'mimir-uid',
      condition: { status: 'False', reason: 'MimirFetchFailed', message: 'connection refused' },
    });
    setupDatasourcesEndpoint(server, [MIMIR_DS]);

    const { result } = renderAutoSyncHook();
    await waitFor(() =>
      expect(result.current.syncHealth).toEqual({
        kind: 'failing',
        reason: 'MimirFetchFailed',
        message: 'connection refused',
      })
    );
  });

  it('reports pending when no condition has been recorded yet', async () => {
    setupAutoSyncConfig(server, { specUid: 'mimir-uid', statusUid: 'mimir-uid' });
    setupDatasourcesEndpoint(server, [MIMIR_DS]);

    const { result } = renderAutoSyncHook();
    await waitFor(() => expect(result.current.syncHealth.kind).toBe('pending'));
  });

  it('reports pending — not healthy — when the condition describes a different UID', async () => {
    // status lags spec by up to a poll tick; a verdict about the previous target says nothing here.
    setupAutoSyncConfig(server, {
      specUid: 'cortex-uid',
      statusUid: 'mimir-uid',
      condition: { status: 'True', reason: 'SyncSucceeded' },
    });
    setupDatasourcesEndpoint(server, [MIMIR_DS, CORTEX_DS]);

    const { result } = renderAutoSyncHook();
    await waitFor(() => expect(result.current.state.kind).toBe('configured'));
    expect(result.current.syncHealth.kind).toBe('pending');
  });

  it('does not carry the previous target error text into a pending verdict', async () => {
    // The pending badge renders reason/message in its tooltip, so forwarding them would pin
    // mimir-uid's failure on the newly selected cortex-uid.
    setupAutoSyncConfig(server, {
      specUid: 'cortex-uid',
      statusUid: 'mimir-uid',
      condition: { status: 'False', reason: 'MimirFetchFailed', message: 'connection refused' },
    });
    setupDatasourcesEndpoint(server, [MIMIR_DS, CORTEX_DS]);

    const { result } = renderAutoSyncHook();
    await waitFor(() => expect(result.current.state.kind).toBe('configured'));
    expect(result.current.syncHealth).toEqual({ kind: 'pending' });
  });

  it('reports pending — not healthy — after sync was disabled but status still names the old UID', async () => {
    setupAutoSyncConfig(server, { statusUid: 'mimir-uid', condition: { status: 'True', reason: 'SyncSucceeded' } });
    setupDatasourcesEndpoint(server, [MIMIR_DS]);

    const { result } = renderAutoSyncHook();
    await waitFor(() => expect(result.current.state.kind).toBe('unconfigured'));
    expect(result.current.syncHealth.kind).toBe('pending');
  });

  it('reports pending when the condition status is Unknown', async () => {
    setupAutoSyncConfig(server, {
      specUid: 'mimir-uid',
      statusUid: 'mimir-uid',
      condition: { status: 'Unknown', reason: 'NotConfigured' },
    });
    setupDatasourcesEndpoint(server, [MIMIR_DS]);

    const { result } = renderAutoSyncHook();
    await waitFor(() => expect(result.current.syncHealth.kind).toBe('pending'));
  });
});

describe('useAutoSyncConfiguration — selection override', () => {
  it('selectedUid follows configuredUid until the user changes it', async () => {
    setupAutoSyncConfig(server, { specUid: 'mimir-uid' });
    setupDatasourcesEndpoint(server, [MIMIR_DS]);

    const { result } = renderAutoSyncHook();
    await waitFor(() => expect(result.current.selectedUid).toBe('mimir-uid'));

    act(() => result.current.setSelectedUid('other-uid'));
    expect(result.current.selectedUid).toBe('other-uid');
  });

  it('does not overwrite user selection on background refetch', async () => {
    setupAutoSyncConfig(server, { specUid: 'mimir-uid' });
    setupDatasourcesEndpoint(server, [MIMIR_DS, CORTEX_DS]);

    const { result, rerender } = renderAutoSyncHook();
    await waitFor(() => expect(result.current.selectedUid).toBe('mimir-uid'));

    // Simulate the user picking a different datasource.
    act(() => result.current.setSelectedUid('cortex-uid'));
    expect(result.current.selectedUid).toBe('cortex-uid');

    // Rerender (which a refetch / unrelated state update would cause). The selection must hold.
    rerender();
    expect(result.current.selectedUid).toBe('cortex-uid');
  });
});

describe('useAutoSyncConfiguration — save / disable', () => {
  it('saves the selected UID onto spec.externalAlertmanagerSync', async () => {
    const { patchSpy, getStored } = setupStatefulAutoSyncConfig(server);
    setupDatasourcesEndpoint(server, [MIMIR_DS]);

    const { result } = renderAutoSyncHook();
    await waitFor(() => expect(result.current.state.kind).toBe('unconfigured'));

    await act(async () => {
      await expect(result.current.save('mimir-uid')).resolves.toBe(true);
    });

    expect(patchSpy).toHaveBeenCalledTimes(1);
    expect(getStored().spec.externalAlertmanagerSync).toEqual({ datasourceUid: 'mimir-uid' });
    await waitFor(() => expect(result.current.state).toEqual({ kind: 'configured', uid: 'mimir-uid' }));
  });

  it('writes a spec-scoped JSON Patch that pins no resourceVersion', async () => {
    // A whole-object PUT would carry metadata.resourceVersion and 409 whenever the worker's status
    // write lands first. The patch must touch spec only.
    const { patchSpy } = setupStatefulAutoSyncConfig(server);
    setupDatasourcesEndpoint(server, [MIMIR_DS]);

    const { result } = renderAutoSyncHook();
    await waitFor(() => expect(result.current.state.kind).toBe('unconfigured'));

    await act(async () => {
      await result.current.save('mimir-uid');
    });

    expect(patchSpy).toHaveBeenCalledWith([
      { op: 'add', path: '/spec/externalAlertmanagerSync', value: { datasourceUid: 'mimir-uid' } },
    ]);
  });

  it('still saves when the worker bumped resourceVersion after the page loaded', async () => {
    // Regression: the sync worker writes status every poll tick (~60s), bumping resourceVersion. A
    // read-modify-write PUT pinned to the version loaded with the page was rejected with a spurious
    // 409, so Disable/Save silently failed for anyone who left the page open for a minute.
    const { patchSpy, getStored } = setupStatefulAutoSyncConfig(server, { specUid: 'mimir-uid' });
    setupDatasourcesEndpoint(server, [MIMIR_DS, CORTEX_DS]);

    const { result } = renderAutoSyncHook();
    await waitFor(() => expect(result.current.state.kind).toBe('configured'));

    // Simulate a worker tick landing between load and save: the stored object moves on.
    await act(async () => {
      await result.current.save('cortex-uid');
    });
    await act(async () => {
      await expect(result.current.save('mimir-uid')).resolves.toBe(true);
    });

    expect(patchSpy).toHaveBeenCalledTimes(2);
    expect(getStored().spec.externalAlertmanagerSync).toEqual({ datasourceUid: 'mimir-uid' });
    // resourceVersion advanced twice, and neither write was rejected.
    expect(getStored().metadata.resourceVersion).toBe('3');
  });

  it('clears the selection override after a successful save so the picker re-syncs to the saved UID', async () => {
    setupStatefulAutoSyncConfig(server, { specUid: 'mimir-uid' });
    setupDatasourcesEndpoint(server, [MIMIR_DS, CORTEX_DS]);

    const { result } = renderAutoSyncHook();
    await waitFor(() => expect(result.current.selectedUid).toBe('mimir-uid'));

    act(() => result.current.setSelectedUid('cortex-uid'));
    expect(result.current.selectedUid).toBe('cortex-uid');

    await act(async () => {
      await result.current.save();
    });

    // The override is cleared and selectedUid follows the newly persisted value.
    await waitFor(() => expect(result.current.selectedUid).toBe('cortex-uid'));
  });

  it('disables sync by clearing the UID rather than deleting the singleton', async () => {
    // delete is unconditionally denied on the singleton; admission explicitly permits clearing.
    const { patchSpy, getStored } = setupStatefulAutoSyncConfig(server, { specUid: 'mimir-uid' });
    setupDatasourcesEndpoint(server, [MIMIR_DS]);

    const { result } = renderAutoSyncHook();
    await waitFor(() => expect(result.current.state).toEqual({ kind: 'configured', uid: 'mimir-uid' }));

    await act(async () => {
      await expect(result.current.disableSync()).resolves.toBe(true);
    });

    expect(patchSpy).toHaveBeenCalledTimes(1);
    expect(getStored().spec.externalAlertmanagerSync).toEqual({});
    await waitFor(() => expect(result.current.state).toEqual({ kind: 'unconfigured' }));
  });

  it('saves after a removed ini key, the recovery path operator-managed would have blocked', async () => {
    const { getStored } = setupStatefulAutoSyncConfig(server, {
      statusUid: 'mimir-uid',
      origin: 'ini',
      syncedReason: 'NotConfigured',
    });
    setupDatasourcesEndpoint(server, [MIMIR_DS, CORTEX_DS]);

    const { result } = renderAutoSyncHook();
    await waitFor(() => expect(result.current.state).toEqual({ kind: 'unconfigured' }));

    await act(async () => {
      await expect(result.current.save('cortex-uid')).resolves.toBe(true);
    });

    expect(getStored().spec.externalAlertmanagerSync).toEqual({ datasourceUid: 'cortex-uid' });
    await waitFor(() => expect(result.current.state).toEqual({ kind: 'configured', uid: 'cortex-uid' }));
  });

  it('reports isReady only once the singleton has been read', async () => {
    setupAutoSyncConfig(server, { specUid: 'mimir-uid' });
    setupDatasourcesEndpoint(server, [MIMIR_DS]);

    const { result } = renderAutoSyncHook();
    expect(result.current.isReady).toBe(false);

    await waitFor(() => expect(result.current.isReady).toBe(true));
  });

  it('reports isReady false — while isLoading is also false — when the singleton is absent', async () => {
    // The gap isLoading cannot express: the read finished and produced nothing, so a write still has
    // nowhere to land. Write affordances have to stay disabled rather than fail on click.
    setupAutoSyncConfigAbsent(server);
    setupDatasourcesEndpoint(server, [MIMIR_DS]);

    const { result } = renderAutoSyncHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isReady).toBe(false);
  });

  it('becomes ready without a remount once the sync worker seeds the singleton', async () => {
    // The promise the not-ready copy makes: "try again in a moment" has to come true for someone who
    // waits on the page. A 404 caches as a rejection with nothing to invalidate it, so only the poll
    // can clear it.
    jest.useFakeTimers();
    setupAutoSyncConfigAbsent(server);
    setupDatasourcesEndpoint(server, [MIMIR_DS]);

    const { result } = renderAutoSyncHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isReady).toBe(false);

    // The worker's first tick lands: the singleton now exists, with no help from the UI.
    setupAutoSyncConfig(server, { specUid: 'mimir-uid' });

    await act(async () => {
      jest.advanceTimersByTime(AUTO_SYNC_CONFIG_POLL_INTERVAL_MS);
    });

    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.state).toEqual({ kind: 'configured', uid: 'mimir-uid' });
  });

  it('refuses to save when the singleton has not been seeded yet', async () => {
    setupAutoSyncConfigAbsent(server);
    setupDatasourcesEndpoint(server, [MIMIR_DS]);

    const { result } = renderAutoSyncHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await expect(result.current.save('mimir-uid')).resolves.toBe(false);
    });

    expect(result.current.state).toEqual({ kind: 'unconfigured' });
    expect(notifyError).toHaveBeenCalledWith('Auto-sync is still initializing', INITIALIZING_MESSAGE);
  });

  it('notifies the read failure rather than "initializing" when a save is attempted anyway', async () => {
    setupAutoSyncConfigReadError(server, { code: 500 });
    setupDatasourcesEndpoint(server, [MIMIR_DS]);

    const { result } = renderAutoSyncHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await expect(result.current.save('mimir-uid')).resolves.toBe(false);
    });

    expect(notifyError).toHaveBeenCalledWith('Could not load the auto-sync configuration', CONFIG_READ_FAILURE_MESSAGE);
  });

  it('invalidates the Alertmanager entity caches after a successful save', async () => {
    // The legacy POST invalidated ALERTMANAGER_PROVIDED_ENTITY_TAGS. replaceConfig lives in a
    // different RTKQ slice and only invalidates 'Config', so this has to be dispatched explicitly —
    // enabling sync rewrites contact points, policies, templates and mute timings.
    setupStatefulAutoSyncConfig(server);
    setupDatasourcesEndpoint(server, [MIMIR_DS]);

    const { result, dispatchSpy } = renderAutoSyncHookWithDispatchSpy();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.save('mimir-uid');
    });

    expect(invalidatedTagSets(dispatchSpy)).toEqual([[...ALERTMANAGER_PROVIDED_ENTITY_TAGS]]);
  });

  it('does not invalidate the Alertmanager caches when the save fails', async () => {
    setupAutoSyncConfigAbsent(server);
    setupDatasourcesEndpoint(server, [MIMIR_DS]);

    const { result, dispatchSpy } = renderAutoSyncHookWithDispatchSpy();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.save('mimir-uid');
    });

    expect(invalidatedTagSets(dispatchSpy)).toEqual([]);
  });

  it('surfaces a failed save without changing the resolved state', async () => {
    const rejection =
      'externalAlertmanagerSync.datasourceUid: external alertmanager UID is managed by the operator (unified_alerting.external_alertmanager_uid); cannot be changed via API';
    setupStatefulAutoSyncConfig(server);
    setupDatasourcesEndpoint(server, [MIMIR_DS]);
    setupAutoSyncConfigWriteError(server, { code: 403, message: rejection });

    const { result } = renderAutoSyncHook();
    await waitFor(() => expect(result.current.state.kind).toBe('unconfigured'));

    await act(async () => {
      await expect(result.current.save('mimir-uid')).resolves.toBe(false);
    });

    expect(result.current.state.kind).toBe('unconfigured');
    // The apimachinery Status message is what tells the admin why the write was refused, so it has
    // to reach the notification rather than being flattened into a generic failure.
    expect(notifyError).toHaveBeenCalledWith('Failed to save Mimir Alertmanager auto-sync', rejection);
    expect(notifySuccess).not.toHaveBeenCalled();
  });
});

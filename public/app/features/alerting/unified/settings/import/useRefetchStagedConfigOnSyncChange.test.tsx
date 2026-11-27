import { act, render, testWithFeatureToggles, waitFor } from 'test/test-utils';

import { configureStore } from 'app/store/configureStore';
import { AccessControlAction } from 'app/types/accessControl';

import { CONFIG_SINGLETON_NAME, configApi } from '../../api/configApi';
import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';
import {
  SYNC_NOT_CONFIGURED_CONDITION,
  SYNC_SUCCEEDED_CONDITION,
  setupAutoSyncConfig,
} from '../../mocks/server/handlers/k8s/config.k8s';

import { useRefetchStagedConfigOnSyncChange } from './useStagedConfig';

const server = setupMswServer();

const SYNC_UID = 'mimir-uid';

function TestComponent({ refetch }: { refetch: () => void }) {
  useRefetchStagedConfigOnSyncChange(refetch);
  return null;
}

/** Re-reads the Config, which is what the auto-sync status polling does on each tick. */
async function pollConfig(store: ReturnType<typeof configureStore>) {
  await act(async () => {
    await store.dispatch(
      configApi.endpoints.getConfig.initiate({ name: CONFIG_SINGLETON_NAME }, { forceRefetch: true })
    );
  });
}

describe('useRefetchStagedConfigOnSyncChange', () => {
  testWithFeatureToggles({ enable: ['alerting.syncExternalAlertmanager'] });

  beforeEach(() => {
    grantUserPermissions([AccessControlAction.ActionAlertingNotificationsConfigRead]);
  });

  it('re-fetches the staged config once when the first sync lands', async () => {
    const { requestSpy } = setupAutoSyncConfig(server, { specUid: SYNC_UID });
    const refetch = jest.fn();

    const store = configureStore();
    render(<TestComponent refetch={refetch} />, { store });
    await waitFor(() => expect(requestSpy).toHaveBeenCalled());
    // What the page loaded with is not a change.
    expect(refetch).not.toHaveBeenCalled();

    setupAutoSyncConfig(server, { specUid: SYNC_UID, statusUid: SYNC_UID, condition: SYNC_SUCCEEDED_CONDITION });
    await pollConfig(store);
    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));

    // A sync that keeps succeeding leaves the status as it was, so it doesn't re-fetch again.
    await pollConfig(store);
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('re-fetches when sync is turned back on for the same datasource', async () => {
    const { requestSpy } = setupAutoSyncConfig(server, {
      specUid: SYNC_UID,
      statusUid: SYNC_UID,
      condition: SYNC_NOT_CONFIGURED_CONDITION,
    });
    const refetch = jest.fn();

    const store = configureStore();
    render(<TestComponent refetch={refetch} />, { store });
    await waitFor(() => expect(requestSpy).toHaveBeenCalled());

    setupAutoSyncConfig(server, { specUid: SYNC_UID, statusUid: SYNC_UID, condition: SYNC_SUCCEEDED_CONDITION });
    await pollConfig(store);
    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
  });
});

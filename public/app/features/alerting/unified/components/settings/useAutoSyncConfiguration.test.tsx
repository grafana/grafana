import { act, renderHook, waitFor } from '@testing-library/react';
import { getWrapper } from 'test/test-utils';

import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';

import { setupMswServer } from '../../mockApi';
import {
  type AdminConfigPostState,
  setupAdminConfigGet,
  setupAdminConfigPost,
  setupAlertmanagersStatus,
} from '../../mocks/server/configure/admin_config';
import { setupDatasourcesEndpoint } from '../../mocks/server/configure/datasources';

import { useAutoSyncConfiguration } from './useAutoSyncConfiguration';

const server = setupMswServer();
const wrapper = () => getWrapper({ renderWithRouter: true });

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

const postState: AdminConfigPostState = { lastPayload: null };

beforeEach(() => {
  postState.lastPayload = null;
  setupAlertmanagersStatus(server);
});

describe('useAutoSyncConfiguration — state resolution', () => {
  it('returns `unconfigured` when no UID and Mimir/Cortex datasources exist', async () => {
    setupAdminConfigGet(server, { alertmanagersChoice: AlertmanagerChoice.Internal });
    setupDatasourcesEndpoint(server, [MIMIR_DS]);

    const { result } = renderHook(() => useAutoSyncConfiguration(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.state.kind).toBe('unconfigured'));
  });

  it('returns `configured` when UID matches a known Mimir datasource', async () => {
    setupAdminConfigGet(server, {
      alertmanagersChoice: AlertmanagerChoice.Internal,
      external_alertmanager_uid: 'mimir-uid',
    });
    setupDatasourcesEndpoint(server, [MIMIR_DS]);

    const { result } = renderHook(() => useAutoSyncConfiguration(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.state).toEqual({ kind: 'configured', uid: 'mimir-uid' }));
  });

  it('returns `configured` when UID matches a Cortex datasource', async () => {
    setupAdminConfigGet(server, {
      alertmanagersChoice: AlertmanagerChoice.Internal,
      external_alertmanager_uid: 'cortex-uid',
    });
    setupDatasourcesEndpoint(server, [CORTEX_DS]);

    const { result } = renderHook(() => useAutoSyncConfiguration(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.state).toEqual({ kind: 'configured', uid: 'cortex-uid' }));
  });

  it('returns `orphan-uid` when configured UID does not match any known datasource', async () => {
    setupAdminConfigGet(server, {
      alertmanagersChoice: AlertmanagerChoice.Internal,
      external_alertmanager_uid: 'missing-uid',
    });
    setupDatasourcesEndpoint(server, [MIMIR_DS]);

    const { result } = renderHook(() => useAutoSyncConfiguration(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.state).toEqual({ kind: 'orphan-uid', uid: 'missing-uid' }));
  });

  it('returns `orphan-uid` (not `no-datasources`) when configured UID is set but no datasources exist', async () => {
    setupAdminConfigGet(server, {
      alertmanagersChoice: AlertmanagerChoice.Internal,
      external_alertmanager_uid: 'missing-uid',
    });
    setupDatasourcesEndpoint(server, []);

    const { result } = renderHook(() => useAutoSyncConfiguration(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.state).toEqual({ kind: 'orphan-uid', uid: 'missing-uid' }));
  });

  it('returns `no-datasources` when no Mimir/Cortex datasources exist and no UID configured', async () => {
    setupAdminConfigGet(server, { alertmanagersChoice: AlertmanagerChoice.Internal });
    setupDatasourcesEndpoint(server, [VANILLA_DS]);

    const { result } = renderHook(() => useAutoSyncConfiguration(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.state.kind).toBe('no-datasources'));
  });

  it('treats a Vanilla (prometheus) Alertmanager datasource as not a Mimir/Cortex source', async () => {
    setupAdminConfigGet(server, { alertmanagersChoice: AlertmanagerChoice.Internal });
    setupDatasourcesEndpoint(server, [VANILLA_DS]);

    const { result } = renderHook(() => useAutoSyncConfiguration(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.state.kind).toBe('no-datasources'));
    expect(result.current.mimirCortexDatasources).toHaveLength(0);
  });

  it('returns `unconfigured` when no UID is configured even if 404 is returned from admin_config', async () => {
    // The backend returns 404 if no admin_config row exists for the org and no ini override.
    setupAdminConfigGet(server, null);
    setupDatasourcesEndpoint(server, [MIMIR_DS]);

    const { result } = renderHook(() => useAutoSyncConfiguration(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.state.kind).toBe('unconfigured'));
  });
});

describe('useAutoSyncConfiguration — selection override', () => {
  it('selectedUid follows configuredUid until the user changes it', async () => {
    setupAdminConfigGet(server, {
      alertmanagersChoice: AlertmanagerChoice.Internal,
      external_alertmanager_uid: 'mimir-uid',
    });
    setupDatasourcesEndpoint(server, [MIMIR_DS]);

    const { result } = renderHook(() => useAutoSyncConfiguration(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.selectedUid).toBe('mimir-uid'));

    act(() => result.current.setSelectedUid('other-uid'));
    expect(result.current.selectedUid).toBe('other-uid');
  });

  it('does not overwrite user selection on background refetch', async () => {
    setupAdminConfigGet(server, {
      alertmanagersChoice: AlertmanagerChoice.Internal,
      external_alertmanager_uid: 'mimir-uid',
    });
    setupDatasourcesEndpoint(server, [MIMIR_DS, CORTEX_DS]);

    const { result, rerender } = renderHook(() => useAutoSyncConfiguration(), { wrapper: wrapper() });
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
  it('sends `{external_alertmanager_uid: <uid>}` on save', async () => {
    setupAdminConfigGet(server, { alertmanagersChoice: AlertmanagerChoice.Internal });
    setupDatasourcesEndpoint(server, [MIMIR_DS]);
    setupAdminConfigPost(server, postState, 200);

    const { result } = renderHook(() => useAutoSyncConfiguration(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.state.kind).toBe('unconfigured'));

    act(() => result.current.setSelectedUid('mimir-uid'));
    await act(async () => {
      await result.current.save();
    });

    expect(postState.lastPayload).toEqual({ external_alertmanager_uid: 'mimir-uid' });
  });

  it('clears the selection override after a successful save so the picker re-syncs to the saved UID', async () => {
    setupAdminConfigGet(server, {
      alertmanagersChoice: AlertmanagerChoice.Internal,
      external_alertmanager_uid: 'mimir-uid',
    });
    setupDatasourcesEndpoint(server, [MIMIR_DS, CORTEX_DS]);
    setupAdminConfigPost(server, postState, 200);

    const { result } = renderHook(() => useAutoSyncConfiguration(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.selectedUid).toBe('mimir-uid'));

    act(() => result.current.setSelectedUid('cortex-uid'));
    expect(result.current.selectedUid).toBe('cortex-uid');

    await act(async () => {
      await result.current.save();
    });

    // The override is cleared; selectedUid follows configuredUid again (still 'mimir-uid' here
    // because our static GET handler doesn't reflect the POST).
    await waitFor(() => expect(result.current.selectedUid).toBe('mimir-uid'));
  });

  it('sends `{external_alertmanager_uid: ""}` on disableSync', async () => {
    setupAdminConfigGet(server, {
      alertmanagersChoice: AlertmanagerChoice.Internal,
      external_alertmanager_uid: 'mimir-uid',
    });
    setupDatasourcesEndpoint(server, [MIMIR_DS]);
    setupAdminConfigPost(server, postState, 200);

    const { result } = renderHook(() => useAutoSyncConfiguration(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.state.kind).toBe('configured'));

    await act(async () => {
      await result.current.disableSync();
    });

    expect(postState.lastPayload).toEqual({ external_alertmanager_uid: '' });
  });

  it('transitions to `operator-managed` when POST returns 409', async () => {
    setupAdminConfigGet(server, {
      alertmanagersChoice: AlertmanagerChoice.Internal,
      external_alertmanager_uid: 'mimir-uid',
    });
    setupDatasourcesEndpoint(server, [MIMIR_DS]);
    setupAdminConfigPost(server, postState, 409, { message: 'managed by operator' });

    const { result } = renderHook(() => useAutoSyncConfiguration(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.state.kind).toBe('configured'));

    act(() => result.current.setSelectedUid('mimir-uid'));
    await act(async () => {
      await result.current.save();
    });

    await waitFor(() => expect(result.current.state).toEqual({ kind: 'operator-managed', uid: 'mimir-uid' }));
  });

  it('stays in `operator-managed` after subsequent re-renders within the session', async () => {
    setupAdminConfigGet(server, {
      alertmanagersChoice: AlertmanagerChoice.Internal,
      external_alertmanager_uid: 'mimir-uid',
    });
    setupDatasourcesEndpoint(server, [MIMIR_DS]);
    setupAdminConfigPost(server, postState, 409);

    const { result, rerender } = renderHook(() => useAutoSyncConfiguration(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.state.kind).toBe('configured'));

    act(() => result.current.setSelectedUid('mimir-uid'));
    await act(async () => {
      await result.current.save();
    });
    await waitFor(() => expect(result.current.state.kind).toBe('operator-managed'));

    rerender();
    expect(result.current.state.kind).toBe('operator-managed');
  });

  it('does not transition to `operator-managed` when POST returns 400 — keeps current state', async () => {
    setupAdminConfigGet(server, { alertmanagersChoice: AlertmanagerChoice.Internal });
    setupDatasourcesEndpoint(server, [MIMIR_DS]);
    setupAdminConfigPost(server, postState, 400, { message: 'invalid datasource' });

    const { result } = renderHook(() => useAutoSyncConfiguration(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.state.kind).toBe('unconfigured'));

    act(() => result.current.setSelectedUid('mimir-uid'));
    await act(async () => {
      await result.current.save();
    });

    expect(result.current.state.kind).toBe('unconfigured');
  });
});

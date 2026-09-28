import { act, renderHook, waitFor } from '@testing-library/react';
import { getWrapper, testWithFeatureToggles } from 'test/test-utils';

import { OrgRole } from '@grafana/data';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../mockApi';
import { grantUserPermissions, grantUserRole } from '../mocks';
import { setupAutoSyncConfig } from '../mocks/server/handlers/k8s/config.k8s';

import { useImportEntrypointState } from './useImportEntrypointState';

const server = setupMswServer();

function renderUseImportEntrypointState() {
  const wrapper = getWrapper({ renderWithRouter: false });
  return renderHook(() => useImportEntrypointState(), { wrapper });
}

describe('useImportEntrypointState', () => {
  beforeEach(() => {
    grantUserPermissions([AccessControlAction.ActionAlertingNotificationsConfigRead]);
  });

  describe('with alerting.syncExternalAlertmanager feature flag enabled', () => {
    testWithFeatureToggles({ enable: ['alerting.syncExternalAlertmanager'] });

    it('returns disabled with a localized reason when the Config status reports an active sync', async () => {
      setupAutoSyncConfig(server, { specUid: 'mimir-uid' });

      const { result } = renderUseImportEntrypointState();

      await waitFor(() => {
        expect(result.current.disabled).toBe(true);
      });
      expect(result.current.reason).toMatch(/auto-sync/i);
    });

    it('blocks non-admins with read access too (the gap this fixes)', async () => {
      grantUserRole(OrgRole.Viewer);
      setupAutoSyncConfig(server, { specUid: 'mimir-uid' });

      const { result } = renderUseImportEntrypointState();

      await waitFor(() => {
        expect(result.current.disabled).toBe(true);
      });
    });

    it('returns not disabled when the Config spec reports no active sync', async () => {
      setupAutoSyncConfig(server, {});

      const { result } = renderUseImportEntrypointState();

      // Give the query a chance to resolve before asserting the false case.
      await waitFor(() => {
        expect(result.current.disabled).toBe(false);
      });
      expect(result.current.reason).toBeUndefined();
    });

    it('ignores a stale status when spec has no sync configured, so imports stay enabled', async () => {
      // status lags spec: it still reports the last synced UID after sync was disabled. The hook
      // must read spec, not status, so imports stay enabled here.
      setupAutoSyncConfig(server, { statusUid: 'mimir-uid' });

      const { result } = renderUseImportEntrypointState();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.disabled).toBe(false);
      expect(result.current.reason).toBeUndefined();
    });

    it('skips the Config query when the user lacks read access, so imports stay enabled', async () => {
      grantUserPermissions([]);
      const { requestSpy } = setupAutoSyncConfig(server, { specUid: 'mimir-uid', statusUid: 'mimir-uid' });

      const { result } = renderUseImportEntrypointState();

      // Flush mount effects and any dispatched query + its response. The permission gate must
      // short-circuit the query (skipToken); if it were removed, the Config endpoint would be
      // hit and report an active sync. Asserting the request never fired is what makes this
      // test fail on a missing gate — `disabled` alone starts false, so it cannot.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(requestSpy).not.toHaveBeenCalled();
      expect(result.current.disabled).toBe(false);
      expect(result.current.reason).toBeUndefined();
    });

    it('reports isLoading while the Config query is in flight, then false', async () => {
      setupAutoSyncConfig(server, { specUid: 'mimir-uid' });

      const { result } = renderUseImportEntrypointState();

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('with alerting.syncExternalAlertmanager feature flag disabled', () => {
    it('returns not disabled regardless of Config state', () => {
      setupAutoSyncConfig(server, { specUid: 'mimir-uid' });

      const { result } = renderUseImportEntrypointState();

      // Feature flag gates the query — the hook should not consider auto-sync active.
      expect(result.current.disabled).toBe(false);
      expect(result.current.reason).toBeUndefined();
    });
  });
});

import { renderHook, waitFor } from '@testing-library/react';
import { getWrapper, testWithFeatureToggles } from 'test/test-utils';

import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../mockApi';
import { grantUserPermissions } from '../mocks';
import { setupAutoSyncConfig, setupAutoSyncConfigAbsent } from '../mocks/server/handlers/k8s/config.k8s';

import { useIsAutoSyncActive } from './useIsAutoSyncActive';

const server = setupMswServer();

function renderIsAutoSyncActive() {
  return renderHook(() => useIsAutoSyncActive(), { wrapper: getWrapper({ renderWithRouter: true }) });
}

async function settledResult() {
  const { result } = renderIsAutoSyncActive();
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  return result;
}

testWithFeatureToggles({ enable: ['alerting.syncExternalAlertmanager'] });

beforeEach(() => {
  grantUserPermissions([AccessControlAction.ActionAlertingNotificationsConfigRead]);
});

describe('useIsAutoSyncActive', () => {
  it('reports active for an API-configured org', async () => {
    setupAutoSyncConfig(server, { specUid: 'mimir-uid' });

    const result = await settledResult();
    expect(result.current.isActive).toBe(true);
  });

  it('reports inactive when nothing is configured', async () => {
    setupAutoSyncConfig(server);

    const result = await settledResult();
    expect(result.current.isActive).toBe(false);
  });

  it('reports inactive for a stale status UID left behind by a disabled sync', async () => {
    setupAutoSyncConfig(server, { statusUid: 'mimir-uid' });

    const result = await settledResult();
    expect(result.current.isActive).toBe(false);
  });

  it('reports active for an operator-configured (ini) sync', async () => {
    setupAutoSyncConfig(server, { statusUid: 'mimir-uid', origin: 'ini' });

    const result = await settledResult();
    expect(result.current.isActive).toBe(true);
  });

  it('keeps reporting active for an ini sync whose last attempt failed', async () => {
    // A check written against the condition's status rather than its reason would unblock imports here.
    setupAutoSyncConfig(server, { statusUid: 'mimir-uid', origin: 'ini', syncedReason: 'MimirFetchFailed' });

    const result = await settledResult();
    expect(result.current.isActive).toBe(true);
  });

  it('reports inactive once the worker stops resolving a removed ini key', async () => {
    // Regression: trusting origin='ini' alone kept imports blocked forever, with no way to recover.
    setupAutoSyncConfig(server, { statusUid: 'mimir-uid', origin: 'ini', syncedReason: 'NotConfigured' });

    const result = await settledResult();
    expect(result.current.isActive).toBe(false);
  });

  it('reports inactive when the singleton has not been seeded yet', async () => {
    setupAutoSyncConfigAbsent(server);

    const result = await settledResult();
    expect(result.current.isActive).toBe(false);
  });

  it('skips the query, and reports inactive, without the read permission', async () => {
    // The read would be a guaranteed 403, and imports must not be blocked by that.
    grantUserPermissions([]);
    const { requestSpy } = setupAutoSyncConfig(server, { specUid: 'mimir-uid' });

    const result = await settledResult();

    expect(requestSpy).not.toHaveBeenCalled();
    expect(result.current.isActive).toBe(false);
  });
});

import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse } from 'msw';
import { TestProvider } from 'test/helpers/TestProvider';

import { setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import {
  customGetUserPermissionsHandler,
  resetMockUserPermissions,
  setMockUserPermissions,
  setTestFlags,
} from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';

import { hasScopedAppAccess, useAppAccessScopes } from './pluginAccess';
import { setupNavTestState } from './test-utils';

setupMockServer();
setBackendSrv(backendSrv);

describe('hasScopedAppAccess', () => {
  it('matches the exact plugin scope', () => {
    expect(hasScopedAppAccess(new Set(['plugins:id:grafana-oncall-app']), 'grafana-oncall-app')).toBe(true);
    expect(hasScopedAppAccess(new Set(['plugins:id:grafana-oncall-app']), 'grafana-slo-app')).toBe(false);
  });

  it.each(['*', 'plugins:*', 'plugins:id:*'])('matches the %s wildcard scope', (wildcard) => {
    expect(hasScopedAppAccess(new Set([wildcard]), 'grafana-oncall-app')).toBe(true);
  });

  it('matches nothing with an empty scope set', () => {
    expect(hasScopedAppAccess(new Set(), 'grafana-oncall-app')).toBe(false);
  });

  // An org-wide grant arrives as scope '', which does not satisfy a scoped
  // requirement in the Go evaluator and must not here either
  it('does not match an unscoped grant', () => {
    expect(hasScopedAppAccess(new Set(['']), 'grafana-oncall-app')).toBe(false);
  });
});

describe('useAppAccessScopes', () => {
  const PLUGIN_NAV_FLAGS = { 'grafana.multiTenantNavTree': true, 'plugins.useMTPlugins': true };

  beforeEach(() => {
    resetMockUserPermissions();
    setupNavTestState({ openFeatureFlags: PLUGIN_NAV_FLAGS });
  });

  afterEach(() => {
    setTestFlags();
  });

  it('collects the plugins.app:access scopes and ignores other actions', async () => {
    setMockUserPermissions([
      { action: 'plugins.app:access', scope: 'plugins:id:grafana-oncall-app' },
      { action: 'plugins.app:access', scope: 'plugins:id:grafana-slo-app' },
      { action: 'dashboards:read', scope: 'folders:*' },
    ]);

    const { result } = renderHook(() => useAppAccessScopes(), { wrapper: TestProvider });

    await waitFor(() =>
      expect(result.current.scopes).toEqual(new Set(['plugins:id:grafana-oncall-app', 'plugins:id:grafana-slo-app']))
    );
  });

  it('resolves an empty set when the action is not held', async () => {
    setMockUserPermissions([{ action: 'dashboards:read', scope: 'folders:*' }]);

    const { result } = renderHook(() => useAppAccessScopes(), { wrapper: TestProvider });

    await waitFor(() => expect(result.current.scopes).toEqual(new Set()));
  });

  // Null tells the caller to fall back to the coarse action-only check
  it.each([403, 500])('resolves null when the endpoint responds %s', async (status) => {
    server.use(customGetUserPermissionsHandler(() => HttpResponse.json(null, { status })));

    const { result } = renderHook(() => useAppAccessScopes(), { wrapper: TestProvider });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.scopes).toBeNull();
  });

  it('skips the request when the client-built plugin nav is off', async () => {
    setupNavTestState();

    const { result } = renderHook(() => useAppAccessScopes(), { wrapper: TestProvider });

    expect(result.current.scopes).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });
});

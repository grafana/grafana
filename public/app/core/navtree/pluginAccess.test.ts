import { HttpResponse } from 'msw';

import { generatedAPI as legacyAPI } from '@grafana/api-clients/internal/rtkq/legacy';
import { setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { customGetUserPermissionsHandler, setMockUserPermissions } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { configureStore } from 'app/store/configureStore';
import { dispatch } from 'app/store/store';

import { fetchAppAccessScopes, hasScopedAppAccess } from './pluginAccess';

setupMockServer();
setBackendSrv(backendSrv);

beforeAll(() => {
  // The fetch dispatches an RTK Query endpoint, so the singleton store must exist
  configureStore();
});

beforeEach(() => {
  // Drop the RTK Query cache so each test's handler response is fetched fresh
  dispatch(legacyAPI.util.resetApiState());
});

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
});

describe('fetchAppAccessScopes', () => {
  it('returns the plugins.app:access scopes from the permissions response', async () => {
    setMockUserPermissions({
      'plugins.app:access': ['plugins:id:grafana-oncall-app', 'plugins:id:grafana-slo-app'],
      'dashboards:read': ['folders:*'],
    });

    await expect(fetchAppAccessScopes()).resolves.toEqual(
      new Set(['plugins:id:grafana-oncall-app', 'plugins:id:grafana-slo-app'])
    );
  });

  it('returns an empty set when the action is not held', async () => {
    setMockUserPermissions({ 'dashboards:read': ['folders:*'] });

    await expect(fetchAppAccessScopes()).resolves.toEqual(new Set());
  });

  it.each([403, 500])('resolves null when the endpoint responds %s', async (status) => {
    server.use(customGetUserPermissionsHandler(() => HttpResponse.json(null, { status })));

    await expect(fetchAppAccessScopes()).resolves.toBeNull();
  });
});

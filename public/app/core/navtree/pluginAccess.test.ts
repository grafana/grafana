import { AccessControlAction } from 'app/types/accessControl';

import { hasAppAccess, hasScopedAppAccess, setAppAccessScopes } from './pluginAccess';
import { setupNavTestState } from './test-utils';

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

describe('hasAppAccess', () => {
  afterEach(() => {
    setAppAccessScopes(null);
  });

  it('evaluates the scopes per plugin once they have been recorded', () => {
    setupNavTestState();
    setAppAccessScopes(new Set(['plugins:id:grafana-oncall-app']));

    expect(hasAppAccess('grafana-oncall-app')).toBe(true);
    expect(hasAppAccess('grafana-slo-app')).toBe(false);
  });

  // Scopes stay null where the deployment never fetches permissions, or where
  // the request failed. The unscoped action then grants every app at once,
  // which is the behaviour without this feature.
  it('falls back to the unscoped action while the scopes are unavailable', () => {
    setupNavTestState({ permissions: [AccessControlAction.PluginsAppAccess] });
    expect(hasAppAccess('grafana-oncall-app')).toBe(true);

    setupNavTestState();
    expect(hasAppAccess('grafana-oncall-app')).toBe(false);
  });

  // A successful response carrying no app access is not the same as no response
  it('denies every app when the recorded scope set is empty', () => {
    setupNavTestState({ permissions: [AccessControlAction.PluginsAppAccess] });
    setAppAccessScopes(new Set());

    expect(hasAppAccess('grafana-oncall-app')).toBe(false);
  });
});

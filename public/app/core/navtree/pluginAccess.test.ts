import { getAppAccessScopes, hasScopedAppAccess, setAppAccessScopes } from './pluginAccess';

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

describe('getAppAccessScopes', () => {
  afterEach(() => {
    setAppAccessScopes(null);
  });

  it('returns the scopes that were recorded', () => {
    setAppAccessScopes(new Set(['plugins:id:grafana-oncall-app']));

    expect(getAppAccessScopes()).toEqual(new Set(['plugins:id:grafana-oncall-app']));
  });

  // Null and empty mean different things to the caller: null is "no answer to go
  // on", so it falls back to the unscoped check, while empty is a successful
  // response carrying no app access at all
  it('tells an absent answer apart from an empty one', () => {
    expect(getAppAccessScopes()).toBeNull();

    setAppAccessScopes(new Set());
    expect(getAppAccessScopes()).toEqual(new Set());
  });
});

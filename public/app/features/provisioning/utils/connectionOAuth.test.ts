import { buildOAuthAuthorizeUrl } from './connectionOAuth';

// Polyfill for jsdom which lacks crypto.randomUUID
if (typeof crypto.randomUUID !== 'function') {
  Object.defineProperty(crypto, 'randomUUID', {
    value: () =>
      '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
        (+c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))).toString(16)
      ),
  });
}

const STATE_PREFIX = 'grafana.provisioning.oauth.';

function getStateKeys() {
  return Object.keys(window.localStorage).filter((key) => key.startsWith(STATE_PREFIX));
}

describe('buildOAuthAuthorizeUrl', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('stores the state entry with a createdAt timestamp', () => {
    buildOAuthAuthorizeUrl('gitlabOAuth', 'client-1', 'conn-1');

    const keys = getStateKeys();
    expect(keys).toHaveLength(1);
    const entry = JSON.parse(window.localStorage.getItem(keys[0]) ?? '');
    expect(entry.name).toBe('conn-1');
    expect(typeof entry.createdAt).toBe('number');
  });

  it('sweeps entries older than one hour but keeps fresh ones', () => {
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    window.localStorage.setItem(`${STATE_PREFIX}stale`, JSON.stringify({ name: 'old', createdAt: twoHoursAgo }));
    window.localStorage.setItem(`${STATE_PREFIX}fresh`, JSON.stringify({ name: 'new', createdAt: Date.now() }));

    buildOAuthAuthorizeUrl('gitlabOAuth', 'client-1', 'conn-1');

    expect(window.localStorage.getItem(`${STATE_PREFIX}stale`)).toBeNull();
    expect(window.localStorage.getItem(`${STATE_PREFIX}fresh`)).not.toBeNull();
  });

  it('sweeps entries without createdAt and malformed entries', () => {
    window.localStorage.setItem(`${STATE_PREFIX}legacy`, JSON.stringify({ name: 'legacy' }));
    window.localStorage.setItem(`${STATE_PREFIX}broken`, 'not-json');

    buildOAuthAuthorizeUrl('gitlabOAuth', 'client-1', 'conn-1');

    expect(window.localStorage.getItem(`${STATE_PREFIX}legacy`)).toBeNull();
    expect(window.localStorage.getItem(`${STATE_PREFIX}broken`)).toBeNull();
  });

  it('leaves keys without the state prefix untouched', () => {
    window.localStorage.setItem('grafana.someOtherKey', 'value');

    buildOAuthAuthorizeUrl('gitlabOAuth', 'client-1', 'conn-1');

    expect(window.localStorage.getItem('grafana.someOtherKey')).toBe('value');
  });

  it('requests only the api scope for GitLab', () => {
    const url = buildOAuthAuthorizeUrl('gitlabOAuth', 'client-1', 'conn-1');

    expect(url).toContain('scope=api');
    expect(url).not.toContain('read_user');
  });
});

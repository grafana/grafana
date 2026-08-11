import { canRotateSessionToken, hasRotatableSession } from './auth';

describe('canRotateSessionToken', () => {
  it.each(['jwt', 'extendedjwt'])('returns false when authenticated by %s', (authenticatedBy) => {
    expect(canRotateSessionToken(authenticatedBy)).toBe(false);
  });

  it.each(['password', 'oauth_azuread', 'auth.saml', 'ldap', 'authproxy'])(
    'returns true when authenticated by %s',
    (authenticatedBy) => {
      expect(canRotateSessionToken(authenticatedBy)).toBe(true);
    }
  );

  it('returns true when the auth method is unknown', () => {
    expect(canRotateSessionToken(undefined)).toBe(true);
    expect(canRotateSessionToken('')).toBe(true);
  });
});

describe('hasRotatableSession', () => {
  afterEach(() => {
    document.cookie = 'grafana_session_expiry=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  });

  it('returns true when the session expiry cookie is present and the auth method rotates', () => {
    document.cookie = 'grafana_session_expiry=1743967026';
    expect(hasRotatableSession('password')).toBe(true);
  });

  it('returns false when the session expiry cookie is present but the request was not session authenticated', () => {
    document.cookie = 'grafana_session_expiry=1743967026';
    expect(hasRotatableSession('jwt')).toBe(false);
  });

  it('returns false when there is no session expiry cookie', () => {
    expect(hasRotatableSession('password')).toBe(false);
  });
});

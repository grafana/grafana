import { canRotateSessionToken } from './auth';

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

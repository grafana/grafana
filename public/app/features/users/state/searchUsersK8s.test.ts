import { toK8sSort, hitToOrgUser, getAvatarUrl, type SearchUserHit } from './searchUsersK8s';
import { sha256Hex } from './sha256';

jest.mock('app/core/services/context_srv', () => ({ contextSrv: { user: { orgId: 1 } } }));

const hit: SearchUserHit = {
  internalId: 7,
  name: 'uid-7',
  title: 'Jane Doe',
  login: 'jane',
  email: 'Jane@Example.com ',
  role: 'Editor',
  created: 1700000000000,
  lastSeenAt: 1700000100,
  lastSeenAtAge: '2 days',
  disabled: false,
  provisioned: true,
  score: 1,
  authLabels: ['LDAP'],
};

describe('searchUsersK8s', () => {
  it.each([
    ['login-asc', 'login'],
    ['name-desc', '-title'],
    ['lastSeenAtAge-desc', '-lastSeenAt'],
    ['email-asc', 'email'],
    [undefined, undefined],
  ])('maps sort %s to %s', (input, expected) => {
    expect(toK8sSort(input)).toBe(expected);
  });

  it('converts seconds and milliseconds timestamps to ISO strings', () => {
    const user = hitToOrgUser(hit);
    expect(user.created).toBe(new Date(1700000000000).toISOString());
    expect(user.lastSeenAt).toBe(new Date(1700000100 * 1000).toISOString());
    expect(user).toMatchObject({ userId: 7, uid: 'uid-7', name: 'Jane Doe', isProvisioned: true, orgId: 1 });
  });

  it('computes a gravatar-style avatar url from a normalised email', () => {
    expect(getAvatarUrl('')).toBe('');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256Hex('a'.repeat(100))).toMatch(/^[0-9a-f]{64}$/);
    expect(getAvatarUrl(' A@B.com ')).toBe(getAvatarUrl('a@b.com'));
    expect(getAvatarUrl('a@b.com')).toMatch(/\/avatar\/[0-9a-f]{64}$/);
  });
});

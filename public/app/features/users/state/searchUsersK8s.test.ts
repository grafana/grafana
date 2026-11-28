import { toK8sSort, hitToOrgUser, type SearchUserHit } from './searchUsersK8s';

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

  it('uses the avatar url returned by the backend', () => {
    expect(hitToOrgUser({ ...hit, avatarUrl: '/avatar/abc123' }).avatarUrl).toBe('/avatar/abc123');
  });

  it('falls back to an empty avatar url when the backend omits it', () => {
    expect(hitToOrgUser(hit).avatarUrl).toBe('');
  });
});

import { OrgRole } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { type OrgUser } from 'app/types/user';

import { getUserLastActive, withUserRoles } from './utils';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
}));

it.each([
  {
    name: 'last seen before account creation',
    user: { lastSeenAt: '2026-10-01', created: '2026-10-02', lastSeenAtAge: '5 days' },
    expected: { text: 'Never', neverLoggedIn: true },
  },
  {
    name: 'last seen after account creation',
    user: { lastSeenAt: '2026-10-02', created: '2026-10-01', lastSeenAtAge: '4 days' },
    expected: { text: '4 days', neverLoggedIn: false },
  },
  {
    name: 'last seen at account creation',
    user: { lastSeenAt: '2026-10-02', created: '2026-10-02', lastSeenAtAge: '4 days' },
    expected: { text: '4 days', neverLoggedIn: false },
  },
  {
    name: 'missing age even when last seen predates account creation',
    user: { lastSeenAt: '2026-10-01', created: '2026-10-02' },
    expected: { text: '', neverLoggedIn: false },
  },
  {
    name: 'missing creation date',
    user: { lastSeenAt: '2026-10-02', lastSeenAtAge: '4 days' },
    expected: { text: '4 days', neverLoggedIn: false },
  },
  {
    name: 'missing last-seen date',
    user: { created: '2026-10-02', lastSeenAtAge: '4 days' },
    expected: { text: '4 days', neverLoggedIn: false },
  },
])('formats last activity for $name', ({ user, expected }) => {
  expect(getUserLastActive(user)).toEqual(expected);
});

describe('withUserRoles', () => {
  const post = jest.fn();
  const alice: OrgUser = {
    userId: 1,
    uid: 'alice',
    orgId: 1,
    login: 'alice',
    email: 'alice@example.com',
    name: 'Alice',
    role: OrgRole.Viewer,
    avatarUrl: '',
    lastSeenAt: '2026-09-27T12:00:00Z',
    lastSeenAtAge: '2 days',
    isDisabled: false,
  };
  const bob: OrgUser = { ...alice, userId: 2, uid: 'bob', login: 'bob' };

  beforeEach(() => {
    post.mockReset();
    jest.mocked(getBackendSrv).mockReturnValue({ ...getBackendSrv(), post });
    jest.spyOn(contextSrv, 'licensedAccessControlEnabled').mockReturnValue(true);
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
  });

  afterEach(() => jest.restoreAllMocks());

  it('adds roles to copies of the users, defaulting to none', async () => {
    const role = { group: 'Custom', displayName: 'Reports', name: 'reports' };
    post.mockResolvedValueOnce({ 1: [role] });
    const users = [alice, bob];

    expect(await withUserRoles(users)).toEqual([
      { ...alice, roles: [role] },
      { ...bob, roles: [] },
    ]);
    expect(post).toHaveBeenCalledWith('/api/access-control/users/roles/search?includeMapped=true', {
      userIds: [1, 2],
      orgId: contextSrv.user.orgId,
    });
    expect(users).toEqual([alice, bob]);
  });

  it('returns the users unchanged without requesting roles when roles cannot be shown', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
    const users = [alice];

    expect(await withUserRoles(users)).toBe(users);
    expect(post).not.toHaveBeenCalled();
  });

  it('does not request roles for an empty list', async () => {
    expect(await withUserRoles([])).toEqual([]);
    expect(post).not.toHaveBeenCalled();
  });
});

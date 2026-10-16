import { OrgRole } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { type OrgUser } from 'app/types/user';

import { withUserRoles } from './utils';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
}));

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

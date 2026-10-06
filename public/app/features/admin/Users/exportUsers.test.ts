import { saveAs } from 'file-saver';

import { OrgRole } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { type OrgUser, type UserDTO } from 'app/types/user';

import { exportUsers, orgUsersToCsv, usersToCsv } from './exportUsers';

jest.mock('file-saver', () => ({ saveAs: jest.fn() }));
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
}));

const alice: UserDTO = {
  id: 1,
  uid: 'alice',
  login: 'alice',
  email: 'alice@example.com',
  name: 'Alice',
  isGrafanaAdmin: false,
  isDisabled: false,
  lastSeenAt: '2026-09-27T12:00:00Z',
  lastSeenAtAge: '2 days',
  authLabels: ['SAML'],
};
const bob: UserDTO = { ...alice, id: 2, uid: 'bob', login: 'bob', name: 'Bob', email: 'bob@example.com' };
const orgAlice: OrgUser = {
  ...alice,
  userId: 1,
  orgId: 1,
  role: OrgRole.Viewer,
  avatarUrl: '',
  lastSeenAt: '2026-09-27T12:00:00Z',
  lastSeenAtAge: '2 days',
};

const get = jest.fn();
const post = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getBackendSrv).mockReturnValue({ ...getBackendSrv(), get, post });
  jest.spyOn(contextSrv, 'licensedAccessControlEnabled').mockReturnValue(false);
});

afterEach(() => jest.restoreAllMocks());

async function savedCsv() {
  const [blob] = jest.mocked(saveAs).mock.calls[0];
  if (typeof blob === 'string') {
    throw new Error('Expected a CSV blob');
  }
  expect(blob.type).toBe('text/csv;charset=utf-8');
  return blob.text();
}

it('downloads every page of all users with the same search, filters and sort', async () => {
  get.mockResolvedValueOnce({ users: [alice], totalCount: 2 }).mockResolvedValueOnce({ users: [bob], totalCount: 2 });

  await exportUsers({
    scope: 'all',
    query: 'a+b & c',
    sort: 'login-desc',
    filters: [
      { name: 'activeLast30Days', value: true },
      { name: 'auth_module', value: [{ value: 'saml' }, { value: 'oauth' }] },
    ],
  });

  expect(get.mock.calls).toEqual([
    [
      '/api/users/search?perpage=1000&page=1&query=a%2Bb+%26+c&activeLast30Days=true&auth_module=saml&auth_module=oauth&sort=login-desc',
    ],
    [
      '/api/users/search?perpage=1000&page=2&query=a%2Bb+%26+c&activeLast30Days=true&auth_module=saml&auth_module=oauth&sort=login-desc',
    ],
  ]);
  expect(await savedCsv()).toBe(
    'Login,Email,Name,Last active,Origin,Provisioned,Disabled\r\n' +
      'alice,alice@example.com,Alice,2026-09-27T12:00:00Z,SAML,,\r\n' +
      'bob,bob@example.com,Bob,2026-09-27T12:00:00Z,SAML,,'
  );
  expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), 'all-users.csv', { autoBom: true });
});

it('downloads every organization user page including permitted custom roles', async () => {
  jest.spyOn(contextSrv, 'licensedAccessControlEnabled').mockReturnValue(true);
  jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
  get.mockResolvedValueOnce({ orgUsers: [{ ...orgAlice }], totalCount: 2 }).mockResolvedValueOnce({
    orgUsers: [{ ...orgAlice, userId: 2, login: 'bob', email: 'bob@example.com', name: 'Bob', role: OrgRole.Editor }],
    totalCount: 2,
  });
  post
    .mockResolvedValueOnce({ 1: [{ group: 'Custom', displayName: 'Reports', name: 'reports' }] })
    .mockResolvedValueOnce({});

  await exportUsers({ scope: 'organization', query: 'example.com', sort: 'email-asc' });

  expect(get.mock.calls).toEqual([
    ['/api/org/users/search', { perpage: 1000, page: 1, query: 'example.com', sort: 'email-asc', accesscontrol: true }],
    ['/api/org/users/search', { perpage: 1000, page: 2, query: 'example.com', sort: 'email-asc', accesscontrol: true }],
  ]);
  expect(post.mock.calls).toEqual([
    ['/api/access-control/users/roles/search?includeMapped=true', { userIds: [1], orgId: contextSrv.user.orgId }],
    ['/api/access-control/users/roles/search?includeMapped=true', { userIds: [2], orgId: contextSrv.user.orgId }],
  ]);
  expect(await savedCsv()).toBe(
    'Login,Email,Name,Last active,Role,Origin,Provisioned,Disabled\r\n' +
      'alice,alice@example.com,Alice,2026-09-27T12:00:00Z,Viewer; Custom:Reports,SAML,,\r\n' +
      'bob,bob@example.com,Bob,2026-09-27T12:00:00Z,Editor,SAML,,'
  );
  expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), 'organization-users.csv', { autoBom: true });
});

it('exports basic roles without requesting custom roles when permission is missing', async () => {
  jest.spyOn(contextSrv, 'licensedAccessControlEnabled').mockReturnValue(true);
  jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
  get.mockResolvedValueOnce({ orgUsers: [orgAlice], totalCount: 1 });

  await exportUsers({ scope: 'organization', query: '' });

  expect(await savedCsv()).toBe(
    'Login,Email,Name,Last active,Role,Origin,Provisioned,Disabled\r\n' +
      'alice,alice@example.com,Alice,2026-09-27T12:00:00Z,Viewer,SAML,,'
  );
  expect(post).not.toHaveBeenCalled();
});

it('rejects a failed later page without downloading a partial CSV', async () => {
  get.mockResolvedValueOnce({ users: [alice], totalCount: 2 }).mockRejectedValueOnce(new Error('Network failure'));

  await expect(exportUsers({ scope: 'all', query: '' })).rejects.toThrow('Network failure');
  expect(saveAs).not.toHaveBeenCalled();
});

it('downloads headers for an empty result', async () => {
  get.mockResolvedValueOnce({ users: [], totalCount: 0 });

  await exportUsers({ scope: 'all', query: 'missing' });

  expect(await savedCsv()).toBe('Login,Email,Name,Last active,Origin,Provisioned,Disabled\r\n');
  expect(get).toHaveBeenCalledTimes(1);
});

it('includes optional organization and licensed-role columns from users on any page', () => {
  expect(
    usersToCsv([
      alice,
      {
        ...bob,
        orgs: [
          { name: 'Main', url: '' },
          { name: 'Other', url: '' },
        ],
        isAdmin: true,
        licensedRole: 'None',
        created: '2026-09-29T12:00:00Z',
        lastSeenAt: '2026-09-28T12:00:00Z',
        isProvisioned: true,
        isDisabled: true,
      },
    ])
  ).toBe(
    'Login,Email,Name,Belongs to,Licensed role,Last active,Origin,Provisioned,Disabled\r\n' +
      'alice,alice@example.com,Alice,,,2026-09-27T12:00:00Z,SAML,,\r\n' +
      'bob,bob@example.com,Bob,Main; Other; Grafana Admin,Not assigned,2026-09-28T12:00:00Z,SAML,Provisioned,Disabled'
  );
});

it('escapes punctuation, newlines and spreadsheet formula prefixes in user fields', () => {
  expect(orgUsersToCsv([{ ...orgAlice, login: '=1+1', name: 'Alice, "A"\nOcenáš' }])).toBe(
    'Login,Email,Name,Last active,Role,Origin,Provisioned,Disabled\r\n' +
      '"\'=1+1",alice@example.com,"Alice, ""A""\nOcenáš",2026-09-27T12:00:00Z,Viewer,SAML,,'
  );
});

it('exports timestamps in both CSV formats even when the relative age is missing', () => {
  expect(usersToCsv([{ ...alice, lastSeenAtAge: undefined }])).toBe(
    'Login,Email,Name,Last active,Origin,Provisioned,Disabled\r\n' +
      'alice,alice@example.com,Alice,2026-09-27T12:00:00Z,SAML,,'
  );
  expect(orgUsersToCsv([{ ...orgAlice, lastSeenAtAge: '' }])).toBe(
    'Login,Email,Name,Last active,Role,Origin,Provisioned,Disabled\r\n' +
      'alice,alice@example.com,Alice,2026-09-27T12:00:00Z,Viewer,SAML,,'
  );
});

it('leaves last active blank when the timestamp is missing', () => {
  expect(usersToCsv([{ ...alice, lastSeenAt: undefined }])).toBe(
    'Login,Email,Name,Last active,Origin,Provisioned,Disabled\r\n' + 'alice,alice@example.com,Alice,,SAML,,'
  );
});

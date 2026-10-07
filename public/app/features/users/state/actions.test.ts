import { OrgRole } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { configureStore } from 'app/store/configureStore';
import { type OrgUser } from 'app/types/user';

import { loadUsers } from './actions';
import { initialState } from './reducers';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
}));

const get = jest.fn();
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

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  jest.mocked(getBackendSrv).mockReturnValue({ ...getBackendSrv(), get, post });
  jest.spyOn(contextSrv, 'licensedAccessControlEnabled').mockReturnValue(true);
  jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
});

afterEach(() => jest.restoreAllMocks());

it('loads the requested table page with custom roles and pagination metadata', async () => {
  const role = { group: 'Custom', displayName: 'Reports', name: 'reports' };
  get.mockResolvedValueOnce({ orgUsers: [{ ...alice }], totalCount: 51, perPage: 30, page: 2 });
  post.mockResolvedValueOnce({ 1: [role] });
  const store = configureStore({
    users: { ...initialState, page: 2, searchQuery: 'alice', sort: 'email-desc' },
  });

  await store.dispatch(loadUsers());

  expect(get).toHaveBeenCalledWith(
    '/api/org/users/search',
    {
      perpage: 30,
      page: 2,
      query: 'alice',
      sort: 'email-desc',
      accesscontrol: true,
    },
    'org-users-list'
  );
  expect(post).toHaveBeenCalledWith(
    '/api/access-control/users/roles/search?includeMapped=true',
    {
      userIds: [1],
      orgId: contextSrv.user.orgId,
    },
    { requestId: 'org-users-list' }
  );
  expect(store.getState().users).toMatchObject({
    users: [{ ...alice, roles: [role] }],
    page: 2,
    perPage: 30,
    totalPages: 2,
    rolesLoading: false,
  });
});

it('clears loading indicators if the custom-role request fails', async () => {
  get.mockResolvedValueOnce({ orgUsers: [{ ...alice }], totalCount: 1, perPage: 30, page: 1 });
  const store = configureStore();
  let rolesLoadingDuringRequest: boolean | undefined;
  post.mockImplementationOnce(async () => {
    rolesLoadingDuringRequest = store.getState().users.rolesLoading;
    throw new Error('Failed to load roles');
  });

  const loading = store.dispatch(loadUsers());
  expect(store.getState().users.rolesLoading).toBe(false);
  await loading;

  expect(rolesLoadingDuringRequest).toBe(true);
  expect(post).toHaveBeenCalledTimes(1);
  expect(store.getState().users).toMatchObject({ users: [], rolesLoading: false, isLoading: false });
});

it('does not enter the role-loading state when roles cannot be shown', async () => {
  jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
  get.mockResolvedValueOnce({ orgUsers: [{ ...alice }], totalCount: 1, perPage: 30, page: 1 });
  const store = configureStore();
  const roleLoadingStates: Array<boolean | undefined> = [];
  const unsubscribe = store.subscribe(() => roleLoadingStates.push(store.getState().users.rolesLoading));

  await store.dispatch(loadUsers());
  unsubscribe();

  expect(store.getState().users.users).toEqual([alice]);
  expect(roleLoadingStates).not.toContain(true);
  expect(post).not.toHaveBeenCalled();
});

it('loads an empty table without requesting roles', async () => {
  get.mockResolvedValueOnce({ orgUsers: [], totalCount: 0, perPage: 30, page: 1 });
  const store = configureStore();
  expect(store.getState().users).toMatchObject({ users: undefined, isLoading: false });

  const request = store.dispatch(loadUsers());
  expect(store.getState().users.isLoading).toBe(true);
  await request;

  expect(store.getState().users).toMatchObject({
    users: [],
    isLoading: false,
    page: 1,
    totalPages: 0,
    rolesLoading: false,
  });
  expect(post).not.toHaveBeenCalled();
});

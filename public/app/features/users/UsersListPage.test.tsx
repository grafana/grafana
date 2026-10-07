import { act, render, screen, waitFor } from 'test/test-utils';

import { OrgRole } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';
import { type OrgUser } from 'app/types/user';

import { UsersListPageContent } from './UsersListPage';
import { type UsersFetchResult } from './state/reducers';

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
  lastSeenAt: '2026-10-01T12:00:00Z',
  lastSeenAtAge: '6 days',
  isDisabled: false,
};
const usersPage: UsersFetchResult = { orgUsers: [alice], totalCount: 1, perPage: 30, page: 1 };

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  jest.mocked(getBackendSrv).mockReturnValue({ ...getBackendSrv(), get, post });
  jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
  jest.spyOn(contextSrv, 'hasPermissionInMetadata').mockReturnValue(false);
  jest.spyOn(contextSrv, 'licensedAccessControlEnabled').mockReturnValue(false);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('delays loading by 250ms and keeps it visible for 750ms without remounting the search input', async () => {
  jest.useFakeTimers();
  let finish!: (result: UsersFetchResult) => void;
  const pending = new Promise<UsersFetchResult>((resolve) => (finish = resolve));
  get.mockReturnValue(pending);
  render(<UsersListPageContent />);

  expect(screen.getByPlaceholderText('Search user by login, email or name')).toBeVisible();
  expect(screen.queryByText('No users found')).not.toBeInTheDocument();
  expect(screen.queryByRole('status', { name: 'Loading users...' })).not.toBeInTheDocument();
  act(() => jest.advanceTimersByTime(249));
  expect(screen.queryByRole('status', { name: 'Loading users...' })).not.toBeInTheDocument();
  act(() => jest.advanceTimersByTime(1));
  expect(screen.getByRole('status', { name: 'Loading users...' })).toBeVisible();
  const search = screen.getByPlaceholderText('Search user by login, email or name');
  search.focus();

  await act(async () => finish(usersPage));

  expect(screen.getByRole('cell', { name: 'Alice' })).toBeInTheDocument();
  expect(search).toHaveFocus();
  act(() => jest.advanceTimersByTime(749));
  expect(screen.getByRole('status', { name: 'Loading users...' })).toBeVisible();
  act(() => jest.advanceTimersByTime(1));
  expect(screen.queryByRole('status', { name: 'Loading users...' })).not.toBeInTheDocument();
});

it('does not show loading for requests completed before the delay', async () => {
  jest.useFakeTimers();
  let finish!: (result: UsersFetchResult) => void;
  get.mockReturnValue(new Promise<UsersFetchResult>((resolve) => (finish = resolve)));
  render(<UsersListPageContent />);

  act(() => jest.advanceTimersByTime(100));
  expect(screen.getByPlaceholderText('Search user by login, email or name')).toBeVisible();
  expect(screen.queryByRole('status', { name: 'Loading users...' })).not.toBeInTheDocument();
  await act(async () => finish(usersPage));

  expect(screen.getByRole('cell', { name: 'Alice' })).toBeInTheDocument();
  act(() => jest.advanceTimersByTime(1000));
  expect(screen.queryByRole('status', { name: 'Loading users...' })).not.toBeInTheDocument();
});

it('shows the empty state when no users match the search', async () => {
  get.mockResolvedValue({ ...usersPage, orgUsers: [], totalCount: 0 });
  render(<UsersListPageContent />);

  expect(await screen.findByText('No users found')).toBeVisible();
  expect(screen.getByPlaceholderText('Search user by login, email or name')).toBeVisible();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  expect(screen.queryByRole('status', { name: 'Loading users...' })).not.toBeInTheDocument();
});

it.each(['users', 'roles'])(
  'shows the empty state and allows searching after the %s request fails',
  async (failedRequest) => {
    let fail!: (error: Error) => void;
    const pending = new Promise<never>((_, reject) => (fail = reject));
    get.mockResolvedValue(usersPage);
    post.mockResolvedValue({});

    if (failedRequest === 'roles') {
      jest.spyOn(contextSrv, 'licensedAccessControlEnabled').mockReturnValue(true);
      jest
        .spyOn(contextSrv, 'hasPermission')
        .mockImplementation((action) => action === AccessControlAction.ActionUserRolesList);
    }

    const { user } = render(<UsersListPageContent />);
    expect(await screen.findByRole('cell', { name: 'Alice' })).toBeInTheDocument();
    const search = screen.getByPlaceholderText('Search user by login, email or name');
    const failedCall = failedRequest === 'users' ? get : post;
    failedCall.mockClear().mockReturnValue(pending);

    await user.type(search, 'ali');
    await waitFor(() => expect(failedCall).toHaveBeenCalled());
    expect(await screen.findByRole('status', { name: 'Loading users...' })).toBeInTheDocument();
    await act(async () => fail(new Error('Request failed')));

    expect(search).toBeVisible();
    expect(await screen.findByText('No users found')).toBeVisible();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Loading users...' })).not.toBeInTheDocument();

    get.mockResolvedValue({ ...usersPage, orgUsers: [{ ...alice, login: 'bob', name: 'Bob' }] });
    post.mockResolvedValue({});
    await user.clear(search);
    await user.type(search, 'bob');

    expect(await screen.findByRole('cell', { name: 'Bob' })).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/api/org/users/search', {
      perpage: 30,
      page: 0,
      query: 'bob',
      sort: undefined,
      accesscontrol: true,
    });
    expect(search).toHaveValue('bob');
    expect(screen.queryByRole('status', { name: 'Loading users...' })).not.toBeInTheDocument();
  }
);

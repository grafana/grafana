import { saveAs } from 'file-saver';
import { act, render, screen, waitFor } from 'test/test-utils';

import { getBackendSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { UsersActionBar } from 'app/features/users/UsersActionBar';
import { configureStore } from 'app/store/configureStore';

import { UserListAdminPageContent } from './UserListAdminPage';

jest.mock('file-saver', () => ({ saveAs: jest.fn() }));
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
}));

const get = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getBackendSrv).mockReturnValue({ ...getBackendSrv(), get });
  jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
  jest.spyOn(contextSrv, 'licensedAccessControlEnabled').mockReturnValue(false);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('delays the loading bar by 250ms and keeps it visible for 750ms before showing the empty state', async () => {
  jest.useFakeTimers();
  let finish!: () => void;
  get.mockReturnValue(
    new Promise((resolve) => (finish = () => resolve({ users: [], totalCount: 0, page: 1, perPage: 50 })))
  );
  render(<UserListAdminPageContent />);

  expect(screen.getByPlaceholderText('Search user by login, email, or name.')).toBeVisible();
  expect(screen.queryByText('No users found')).not.toBeInTheDocument();
  expect(screen.queryByRole('status', { name: 'Loading users...' })).not.toBeInTheDocument();
  act(() => jest.advanceTimersByTime(249));
  expect(screen.queryByRole('status', { name: 'Loading users...' })).not.toBeInTheDocument();
  act(() => jest.advanceTimersByTime(1));
  expect(screen.getByRole('status', { name: 'Loading users...' })).toBeVisible();

  await act(async () => finish());
  act(() => jest.advanceTimersByTime(749));
  expect(screen.getByRole('status', { name: 'Loading users...' })).toBeVisible();
  expect(screen.queryByText('No users found')).not.toBeInTheDocument();
  act(() => jest.advanceTimersByTime(1));
  expect(screen.getByText('No users found')).toBeVisible();
  expect(screen.queryByRole('status', { name: 'Loading users...' })).not.toBeInTheDocument();
});

it('does not show the loading bar for a fast initial request', async () => {
  jest.useFakeTimers();
  get.mockResolvedValue({ users: [], totalCount: 0, page: 1, perPage: 50 });
  render(<UserListAdminPageContent />);

  expect(screen.getByPlaceholderText('Search user by login, email, or name.')).toBeVisible();
  expect(screen.queryByRole('status', { name: 'Loading users...' })).not.toBeInTheDocument();
  expect(await screen.findByText('No users found')).toBeVisible();
  act(() => jest.advanceTimersByTime(1000));
  expect(screen.queryByRole('status', { name: 'Loading users...' })).not.toBeInTheDocument();
});

it('exports all users from the toolbar between filters and New user using the current search', async () => {
  get.mockResolvedValue({ users: [], totalCount: 0, page: 1, perPage: 50 });
  const initialState = configureStore().getState();
  const { user } = render(<UserListAdminPageContent />, {
    preloadedState: {
      userListAdmin: {
        ...initialState.userListAdmin,
        users: [],
        isLoading: false,
        query: 'alice',
        sort: 'email-desc',
        filters: [{ name: 'activeLast30Days', value: true }],
      },
    },
  });

  const button = screen.getByRole('button', { name: 'Download table as CSV' });
  const filter = screen.getByRole('radio', { name: 'Active last 30 days' });
  const newUser = screen.getByRole('link', { name: 'New user' });
  expect(filter.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(button.compareDocumentPosition(newUser) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

  await user.click(button);

  await waitFor(() =>
    expect(saveAs).toHaveBeenCalledWith(
      expect.any(Blob),
      expect.stringMatching(/^all-users-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.csv$/),
      { autoBom: true }
    )
  );
  expect(get).toHaveBeenCalledWith(
    '/api/users/search?perpage=1000&page=1&query=alice&activeLast30Days=true&sort=email-desc',
    undefined,
    undefined
  );
});

it('exports organization users with the current search and hides the button for pending invites', async () => {
  get.mockResolvedValue({ orgUsers: [], totalCount: 0 });
  const initialState = configureStore().getState();
  const { user, rerender } = render(<UsersActionBar showInvites={false} onShowInvites={jest.fn()} />, {
    preloadedState: { users: { ...initialState.users, searchQuery: 'saml', sort: 'login-desc' } },
  });

  await user.click(screen.getByRole('button', { name: 'Download table as CSV' }));

  await waitFor(() =>
    expect(saveAs).toHaveBeenCalledWith(
      expect.any(Blob),
      expect.stringMatching(/^organization-users-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.csv$/),
      { autoBom: true }
    )
  );
  expect(get).toHaveBeenCalledWith(
    '/api/org/users/search',
    {
      perpage: 1000,
      page: 1,
      query: 'saml',
      sort: 'login-desc',
      accesscontrol: true,
    },
    undefined
  );

  rerender(<UsersActionBar showInvites={true} onShowInvites={jest.fn()} />);
  expect(screen.queryByRole('button', { name: 'Download table as CSV' })).not.toBeInTheDocument();
});

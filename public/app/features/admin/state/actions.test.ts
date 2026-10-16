import { getBackendSrv } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';

import { changeQuery, fetchUsers } from './actions';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
}));

const get = jest.fn();

beforeEach(() => {
  get.mockReset();
  jest.mocked(getBackendSrv).mockReturnValue({ ...getBackendSrv(), get });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('clears the loading state if the users request fails', async () => {
  const error = new Error('Failed to load users');
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  get.mockRejectedValueOnce(error);
  const store = configureStore();
  expect(store.getState().userListAdmin).toMatchObject({ users: undefined, isLoading: false });

  const request = store.dispatch(fetchUsers());
  expect(store.getState().userListAdmin.isLoading).toBe(true);
  await request;

  expect(store.getState().userListAdmin).toMatchObject({ users: [], isLoading: false });
  expect(consoleError).toHaveBeenCalledWith(error);
});

it('only enters loading when the debounced search request starts and stores an empty result', async () => {
  jest.useFakeTimers();
  const store = configureStore();
  let finish!: () => void;
  get.mockReturnValue(
    new Promise((resolve) => (finish = () => resolve({ users: [], totalCount: 0, page: 0, perPage: 50 })))
  );

  await store.dispatch(changeQuery('alice'));
  expect(store.getState().userListAdmin).toMatchObject({ users: undefined, query: 'alice', isLoading: false });
  expect(get).not.toHaveBeenCalled();
  jest.advanceTimersByTime(500);
  expect(get).toHaveBeenCalledWith(
    '/api/users/search?perpage=50&page=0&query=alice&activeLast30Days=false',
    undefined,
    'all-users-list'
  );
  expect(store.getState().userListAdmin.isLoading).toBe(true);

  finish();
  await Promise.resolve();
  expect(store.getState().userListAdmin).toMatchObject({ users: [], isLoading: false });
});

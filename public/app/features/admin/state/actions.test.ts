import { getBackendSrv } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';

import { fetchUsers } from './actions';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
}));

const get = jest.fn();

beforeEach(() => {
  get.mockReset();
  jest.mocked(getBackendSrv).mockReturnValue({ ...getBackendSrv(), get });
});

afterEach(() => jest.restoreAllMocks());

it('clears the loading state if the users request fails', async () => {
  const error = new Error('Failed to load users');
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  get.mockRejectedValueOnce(error);
  const store = configureStore();
  expect(store.getState().userListAdmin.isLoading).toBe(true);

  await store.dispatch(fetchUsers());

  expect(store.getState().userListAdmin.isLoading).toBe(false);
  expect(consoleError).toHaveBeenCalledWith(error);
});

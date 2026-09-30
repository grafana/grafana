import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { saveAs } from 'file-saver';

import { AppEvents } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { appEvents } from 'app/core/app_events';

import { ExportUsersButton } from './ExportUsersButton';

jest.mock('file-saver', () => ({ saveAs: jest.fn() }));
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
}));

const get = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getBackendSrv).mockReturnValue({ ...getBackendSrv(), get });
});

afterEach(() => jest.restoreAllMocks());

it('disables the button while gathering pages and enables it after the download', async () => {
  let finish!: (value: { users: []; totalCount: number }) => void;
  get.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
  render(<ExportUsersButton scope="all" query="alice" sort="login-asc" />);

  await userEvent.click(screen.getByRole('button', { name: 'Download CSV' }));

  expect(screen.getByRole('button', { name: 'Exporting…' })).toBeDisabled();
  expect(get).toHaveBeenCalledWith('/api/users/search?perpage=1000&page=1&query=alice&sort=login-asc');
  expect(saveAs).not.toHaveBeenCalled();

  await act(async () => finish({ users: [], totalCount: 0 }));

  expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), 'all-users.csv', { autoBom: true });
  expect(screen.getByRole('button', { name: 'Download CSV' })).toBeEnabled();
});

it('reports a failed export and allows retrying the download', async () => {
  const emit = jest.spyOn(appEvents, 'emit');
  get.mockRejectedValueOnce(new Error('Failed')).mockResolvedValueOnce({ users: [], totalCount: 0 });
  render(<ExportUsersButton scope="all" query="" />);

  await userEvent.click(screen.getByRole('button', { name: 'Download CSV' }));

  await waitFor(() =>
    expect(emit).toHaveBeenCalledWith(AppEvents.alertError, ['Failed to export users. Please try again.'])
  );
  expect(screen.getByRole('button', { name: 'Download CSV' })).toBeEnabled();
  expect(saveAs).not.toHaveBeenCalled();

  await userEvent.click(screen.getByRole('button', { name: 'Download CSV' }));

  await waitFor(() => expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), 'all-users.csv', { autoBom: true }));
});

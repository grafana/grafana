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

it('shows the download label in a tooltip instead of inside the button', async () => {
  render(<ExportUsersButton scope="all" query="" />);
  const button = screen.getByRole('button', { name: 'Download table as CSV' });

  await userEvent.hover(button);

  expect(await screen.findByRole('tooltip')).toHaveTextContent('Download table as CSV');
  expect(button).not.toHaveTextContent('Download table as CSV');
});

it('disables the button while gathering pages and enables it after the download', async () => {
  let finish!: (value: { users: []; totalCount: number }) => void;
  get.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
  render(<ExportUsersButton scope="all" query="alice" sort="login-asc" />);

  await userEvent.click(screen.getByRole('button', { name: 'Download table as CSV' }));

  const exportingButton = screen.getByRole('button', { name: 'Exporting…' });
  expect(exportingButton).toHaveAttribute('aria-disabled', 'true');
  await userEvent.click(exportingButton);
  expect(get).toHaveBeenCalledTimes(1);
  expect(get).toHaveBeenCalledWith('/api/users/search?perpage=1000&page=1&query=alice&sort=login-asc');
  expect(saveAs).not.toHaveBeenCalled();

  await act(async () => finish({ users: [], totalCount: 0 }));

  expect(saveAs).toHaveBeenCalledWith(
    expect.any(Blob),
    expect.stringMatching(/^all-users-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.csv$/),
    { autoBom: true }
  );
  expect(screen.getByRole('button', { name: 'Download table as CSV' })).toHaveAttribute('aria-disabled', 'false');
});

it('reports a failed export and allows retrying the download', async () => {
  const emit = jest.spyOn(appEvents, 'emit');
  get.mockRejectedValueOnce(new Error('Failed')).mockResolvedValueOnce({ users: [], totalCount: 0 });
  render(<ExportUsersButton scope="all" query="" />);

  await userEvent.click(screen.getByRole('button', { name: 'Download table as CSV' }));

  await waitFor(() =>
    expect(emit).toHaveBeenCalledWith(AppEvents.alertError, ['Failed to export users. Please try again.'])
  );
  expect(screen.getByRole('button', { name: 'Download table as CSV' })).toHaveAttribute('aria-disabled', 'false');
  expect(saveAs).not.toHaveBeenCalled();

  await userEvent.click(screen.getByRole('button', { name: 'Download table as CSV' }));

  await waitFor(() =>
    expect(saveAs).toHaveBeenCalledWith(
      expect.any(Blob),
      expect.stringMatching(/^all-users-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.csv$/),
      { autoBom: true }
    )
  );
});

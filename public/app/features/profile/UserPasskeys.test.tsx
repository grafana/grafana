import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { getBackendSrv } from '@grafana/runtime';

import { UserPasskeys, type UserPasskey } from './UserPasskeys';

jest.mock('@grafana/runtime', () => {
  const original = jest.requireActual('@grafana/runtime');
  return {
    ...original,
    getBackendSrv: jest.fn(),
  };
});

const samplePasskeys: UserPasskey[] = [
  { id: 1, name: 'Yubikey', created: '2026-01-15T10:00:00Z', lastUsed: '2026-06-20T08:30:00Z' },
  { id: 2, name: 'MacBook Touch ID', created: '2026-03-02T12:00:00Z' },
];

const installBackendSrv = (overrides: { get?: jest.Mock; patch?: jest.Mock; delete?: jest.Mock } = {}) => {
  const get = overrides.get ?? jest.fn().mockResolvedValue(samplePasskeys);
  const patch = overrides.patch ?? jest.fn().mockResolvedValue(undefined);
  const del = overrides.delete ?? jest.fn().mockResolvedValue(undefined);
  (getBackendSrv as jest.Mock).mockReturnValue({ get, patch, delete: del });
  return { get, patch, delete: del };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('UserPasskeys', () => {
  it('renders the list of registered passkeys', async () => {
    installBackendSrv();
    render(<UserPasskeys />);
    expect(await screen.findByText('Yubikey')).toBeInTheDocument();
    expect(screen.getByText('MacBook Touch ID')).toBeInTheDocument();
  });

  it('shows an empty state when the user has no passkeys', async () => {
    installBackendSrv({ get: jest.fn().mockResolvedValue([]) });
    render(<UserPasskeys />);
    expect(await screen.findByText(/haven't registered any passkeys/i)).toBeInTheDocument();
  });

  it('renames a passkey via PATCH and refreshes the list', async () => {
    const get = jest
      .fn()
      .mockResolvedValueOnce(samplePasskeys)
      .mockResolvedValueOnce([{ ...samplePasskeys[0], name: 'Renamed' }, samplePasskeys[1]]);
    const { patch } = installBackendSrv({ get });

    render(<UserPasskeys />);
    await screen.findByText('Yubikey');

    const yubikeyRow = screen.getByText('Yubikey').closest('tr')!;
    await userEvent.click(within(yubikeyRow).getByLabelText('Rename passkey'));
    const input = within(yubikeyRow).getByLabelText('Passkey name');
    await userEvent.clear(input);
    await userEvent.type(input, 'Renamed');
    await userEvent.click(within(yubikeyRow).getByLabelText('Save'));

    await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/user/passkey/credentials/1', { name: 'Renamed' }));
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('opens a confirmation modal before deleting and calls DELETE on confirm', async () => {
    const get = jest.fn().mockResolvedValueOnce(samplePasskeys).mockResolvedValueOnce([samplePasskeys[1]]);
    const { delete: del } = installBackendSrv({ get });

    render(<UserPasskeys />);
    await screen.findByText('Yubikey');

    const yubikeyRow = screen.getByText('Yubikey').closest('tr')!;
    await userEvent.click(within(yubikeyRow).getByLabelText('Delete passkey'));

    const modal = await screen.findByRole('dialog');
    expect(within(modal).getByText(/cannot be undone/i)).toBeInTheDocument();

    // The confirm button is disabled until the user types the confirmation text.
    const confirmButton = within(modal).getByRole('button', { name: 'Delete' });
    expect(confirmButton).toBeDisabled();
    await userEvent.type(within(modal).getByRole('textbox'), 'Delete');
    expect(confirmButton).toBeEnabled();
    await userEvent.click(confirmButton);

    await waitFor(() => expect(del).toHaveBeenCalledWith('/api/user/passkey/credentials/1'));
  });

  it('does not call DELETE when the user cancels the modal', async () => {
    installBackendSrv();
    const { delete: del } = installBackendSrv();

    render(<UserPasskeys />);
    await screen.findByText('Yubikey');
    const yubikeyRow = screen.getByText('Yubikey').closest('tr')!;
    await userEvent.click(within(yubikeyRow).getByLabelText('Delete passkey'));

    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(del).not.toHaveBeenCalled();
  });

  it('falls back to the empty state when the list fetch fails', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    installBackendSrv({ get: jest.fn().mockRejectedValue(new Error('boom')) });

    render(<UserPasskeys />);

    expect(await screen.findByText(/haven't registered any passkeys/i)).toBeInTheDocument();
    expect(consoleSpy).toHaveBeenCalledWith('Failed to load passkeys', expect.any(Error));
    consoleSpy.mockRestore();
  });
});

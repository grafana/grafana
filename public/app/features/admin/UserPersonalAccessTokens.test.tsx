import { act, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

import { contextSrv } from 'app/core/services/context_srv';
import { personalAccessTokensApi } from 'app/features/personal-access-tokens/api';

import { UserPersonalAccessTokens } from './UserPersonalAccessTokens';

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  useFlagPersonalAccessTokens: jest.fn(),
}));
jest.mock('app/features/personal-access-tokens/api', () => ({
  personalAccessTokensApi: { listForUser: jest.fn(), revokeForUser: jest.fn() },
}));

const { useFlagPersonalAccessTokens } = jest.requireMock('@grafana/runtime/internal');
const api = jest.mocked(personalAccessTokensApi);
const mk = (uid: string, name: string) => ({
  uid,
  name,
  hint: 'glpat_ab',
  scopes: { '*': [] },
  createdAt: '2026-01-01T00:00:00Z',
});

describe('UserPersonalAccessTokens', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    useFlagPersonalAccessTokens.mockReturnValue(true);
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
    api.listForUser.mockResolvedValue([mk('a', 'one'), mk('b', 'two')]);
  });

  it('lists tokens without a create button', async () => {
    render(<UserPersonalAccessTokens userId={5} />);
    expect(await screen.findByText('one')).toBeInTheDocument();
    expect(api.listForUser).toHaveBeenCalledWith(5);
    expect(screen.queryByRole('button', { name: /add|create/i })).not.toBeInTheDocument();
  });

  it('revokes all active tokens after confirmation', async () => {
    api.revokeForUser.mockResolvedValue(undefined);
    render(<UserPersonalAccessTokens userId={5} />);
    await screen.findByText('one');
    await userEvent.click(screen.getByRole('button', { name: 'Revoke all tokens' }));
    await userEvent.click(screen.getByRole('button', { name: 'Revoke all' }));
    await waitFor(() => expect(api.revokeForUser).toHaveBeenCalledTimes(2));
    expect(api.revokeForUser).toHaveBeenCalledWith(5, 'a');
    expect(api.revokeForUser).toHaveBeenCalledWith(5, 'b');
  });

  it('renders nothing without read permission', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
    const { container } = render(<UserPersonalAccessTokens userId={5} />);
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
    expect(api.listForUser).not.toHaveBeenCalled();
  });
});

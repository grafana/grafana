import { render, screen, waitFor } from 'test/test-utils';

import { contextSrv } from 'app/core/services/context_srv';

import { buildScopes } from './CreatePersonalAccessTokenModal';
import { PersonalAccessTokenPolicySwitch } from './PersonalAccessTokenPolicySwitch';
import { PersonalAccessTokensPage } from './PersonalAccessTokensPage';
import { personalAccessTokensApi } from './api';

jest.mock('./api', () => ({
  personalAccessTokensApi: {
    list: jest.fn(),
    create: jest.fn(),
    revoke: jest.fn(),
    getPolicy: jest.fn(),
    getEffectivePolicy: jest.fn(),
    updatePolicy: jest.fn(),
  },
}));

jest.mock('app/core/components/Page/Page', () => {
  const Page = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  Page.Contents = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  return { Page };
});

const api = jest.mocked(personalAccessTokensApi);

const token = {
  uid: 'abc',
  name: 'ci-token',
  hint: 'glpat_abcd…',
  scopes: { '*:read': [] },
  createdAt: '2026-01-01T00:00:00Z',
  expiresAt: null,
  lastUsedAt: null,
  revokedAt: null,
};

describe('buildScopes', () => {
  it('maps presets and custom actions', () => {
    expect(buildScopes('read-only', '')).toEqual({ '*:read': [] });
    expect(buildScopes('full', '')).toEqual({ '*': [] });
    expect(buildScopes('custom', 'dashboards:read, folders:*\nusers:read')).toEqual({
      'dashboards:read': [],
      'folders:*': [],
      'users:read': [],
    });
    expect(buildScopes('custom', '  ')).toEqual({});
  });
});

describe('PersonalAccessTokensPage', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
    api.list.mockResolvedValue([token]);
    api.getEffectivePolicy.mockResolvedValue({ enabled: true, managedByConfig: false });
  });

  it('lists tokens without exposing a secret', async () => {
    render(<PersonalAccessTokensPage />);
    expect(await screen.findByText('ci-token')).toBeInTheDocument();
    expect(screen.getByText('glpat_abcd…')).toBeInTheDocument();
  });

  it('shows the secret once after creation and drops it when closed', async () => {
    api.create.mockResolvedValue({ ...token, token: 'glpat_secretvalue' });
    const { user } = render(<PersonalAccessTokensPage />);
    await screen.findByText('ci-token');

    await user.click(screen.getByRole('button', { name: 'Add token' }));
    await user.type(screen.getByLabelText(/Display name/), 'new-token');
    await user.click(screen.getByRole('button', { name: 'Generate token' }));

    expect(api.create).toHaveBeenCalledWith({ name: 'new-token', scopes: { '*:read': [] }, lifetimeDays: 30 });
    expect(await screen.findByDisplayValue('glpat_secretvalue')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Close' }).pop()!);
    expect(screen.queryByDisplayValue('glpat_secretvalue')).not.toBeInTheDocument();
  });

  it('revokes after confirmation', async () => {
    api.revoke.mockResolvedValue(undefined);
    const { user } = render(<PersonalAccessTokensPage />);
    await user.click(await screen.findByRole('button', { name: /Revoke token ci-token/ }));
    await user.click(screen.getByRole('button', { name: 'Revoke' }));
    await waitFor(() => expect(api.revoke).toHaveBeenCalledWith('abc'));
  });

  it('disables creation without permission', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
    render(<PersonalAccessTokensPage />);
    await screen.findByText('ci-token');
    expect(screen.getByRole('button', { name: 'Add token' })).toBeDisabled();
  });
});

describe('PersonalAccessTokensPage when disabled by policy', () => {
  it('shows a notice, disables creation and keeps revoke available', async () => {
    jest.resetAllMocks();
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
    api.list.mockResolvedValue([token]);
    api.getEffectivePolicy.mockResolvedValue({ enabled: false, managedByConfig: false });
    render(<PersonalAccessTokensPage />);
    expect(await screen.findByText('Personal access tokens are disabled by your administrator')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add token' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /revoke/i })).toBeEnabled();
  });
});

describe('PersonalAccessTokenPolicySwitch', () => {
  beforeEach(() => jest.resetAllMocks());

  it('is read-only when managed by config', async () => {
    api.getPolicy.mockResolvedValue({ enabled: true, managedByConfig: true });
    render(<PersonalAccessTokenPolicySwitch level="instance" canWrite />);
    expect(await screen.findByText(/managed by the Grafana configuration/)).toBeInTheDocument();
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('disables with revokeExisting after confirmation', async () => {
    api.getPolicy.mockResolvedValue({ enabled: true, managedByConfig: false });
    api.updatePolicy.mockResolvedValue({ enabled: false, managedByConfig: false, revoked: 2 });
    const { user } = render(<PersonalAccessTokenPolicySwitch level="org" canWrite />);

    await user.click(await screen.findByRole('switch'));
    await user.click(screen.getByLabelText('Also permanently revoke existing tokens'));
    await user.click(screen.getByRole('button', { name: 'Disable' }));

    await waitFor(() => expect(api.updatePolicy).toHaveBeenCalledWith('org', { enabled: false, revokeExisting: true }));
    expect(await screen.findByText('2 tokens revoked')).toBeInTheDocument();
  });
});

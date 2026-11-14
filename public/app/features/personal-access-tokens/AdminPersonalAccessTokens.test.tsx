import { render, screen, waitFor } from 'test/test-utils';

import { contextSrv } from 'app/core/services/context_srv';

import { AdminPersonalAccessTokensPage } from './AdminPersonalAccessTokensPage';
import { personalAccessTokensApi } from './api';
import { type AdminPersonalAccessToken } from './types';

jest.mock('./api', () => ({
  personalAccessTokensApi: {
    search: jest.fn(),
    revokeByUid: jest.fn(),
    getPolicy: jest.fn(),
    updatePolicy: jest.fn(),
  },
}));

jest.mock('app/core/components/Page/Page', () => {
  const Page = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  Page.Contents = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  return { Page };
});

const api = jest.mocked(personalAccessTokensApi);

const token: AdminPersonalAccessToken = {
  uid: 'abc',
  name: 'ci-token',
  hint: 'glpat_abcd',
  scopes: { 'dashboards:read': [] },
  createdAt: '2026-01-01T00:00:00Z',
  userId: 3,
  ownerLogin: 'bob',
  ownerEmail: 'bob@example.com',
  ownerName: 'Bob',
  orgId: 1,
  orgName: 'Main Org.',
  createdIp: '10.0.0.1',
  lastUsedIp: '',
  lastUsedUserAgent: '',
  revokedReason: '',
};

describe('AdminPersonalAccessTokensPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
    contextSrv.isGrafanaAdmin = false;
    api.getPolicy.mockResolvedValue({ enabled: true, managedByConfig: false });
    api.search.mockResolvedValue({ tokens: [token], totalCount: 1, page: 1, perPage: 25 });
  });

  it('lists tokens with owner and org', async () => {
    render(<AdminPersonalAccessTokensPage />);
    expect(await screen.findByText('ci-token')).toBeInTheDocument();
    expect(screen.getByText('bob')).toBeInTheDocument();
    expect(screen.getByText('Main Org.')).toBeInTheDocument();
    expect(api.search).toHaveBeenCalledWith(expect.objectContaining({ page: 1, allOrgs: false }));
  });

  it('searches by text', async () => {
    const { user } = render(<AdminPersonalAccessTokensPage />);
    await screen.findByText('ci-token');
    await user.type(screen.getByPlaceholderText('Token name, owner login or email'), 'bob');
    await waitFor(() => expect(api.search).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'bob' })));
  });

  it('sorts server-side when a column header is clicked', async () => {
    const { user } = render(<AdminPersonalAccessTokensPage />);
    await screen.findByText('ci-token');
    await user.click(screen.getByRole('button', { name: 'Expires' }));
    await waitFor(() =>
      expect(api.search).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'expires', order: 'asc', page: 1 }))
    );
    await user.click(screen.getByRole('button', { name: 'Expires' }));
    await waitFor(() => expect(api.search).toHaveBeenLastCalledWith(expect.objectContaining({ order: 'desc' })));
    expect(screen.getByRole('columnheader', { name: 'Expires' })).toHaveAttribute('aria-sort', 'descending');
  });

  it('offers the all-organizations filter only to server admins', async () => {
    render(<AdminPersonalAccessTokensPage />);
    await screen.findByText('ci-token');
    expect(screen.queryByLabelText('All organizations')).not.toBeInTheDocument();
  });

  it('opens details and revokes after confirmation', async () => {
    api.revokeByUid.mockResolvedValue(undefined);
    const { user } = render(<AdminPersonalAccessTokensPage />);
    await user.click(await screen.findByRole('link', { name: 'View token ci-token' }));
    expect(await screen.findByText('10.0.0.1', { exact: false })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Revoke token' }));
    await user.click(await screen.findByRole('button', { name: 'Revoke' }));
    await waitFor(() => expect(api.revokeByUid).toHaveBeenCalledWith('abc', false));
  });
});

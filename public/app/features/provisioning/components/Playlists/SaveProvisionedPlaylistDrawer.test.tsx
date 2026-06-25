import { HttpResponse, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type Playlist } from 'app/api/clients/playlist/v1';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { useGetResourceRepositoryView } from '../../hooks/useGetResourceRepositoryView';
import { setupProvisioningMswServer } from '../../mocks/server';

import { SaveProvisionedPlaylistDrawer } from './SaveProvisionedPlaylistDrawer';

setupProvisioningMswServer();

jest.mock('../../hooks/usePRBranch', () => ({
  usePRBranch: jest.fn().mockReturnValue(undefined),
}));

jest.mock('../../hooks/useLastBranch', () => ({
  useLastBranch: jest.fn().mockReturnValue({
    getLastBranch: jest.fn().mockReturnValue(undefined),
    setLastBranch: jest.fn(),
  }),
}));

jest.mock('../../hooks/useGetResourceRepositoryView', () => ({
  ...jest.requireActual('../../hooks/useGetResourceRepositoryView'),
  useGetResourceRepositoryView: jest.fn(),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom-v5-compat', () => {
  const actual = jest.requireActual('react-router-dom-v5-compat');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockPlaylist: Playlist = {
  apiVersion: 'playlist.grafana.app/v0alpha1',
  kind: 'Playlist',
  metadata: {
    name: 'playlist-uid',
    annotations: {
      'grafana.app/managedBy': 'repo',
      'grafana.app/managerId': 'test-repo',
      'grafana.app/sourcePath': 'playlists/test-playlist.json',
    },
  },
  spec: {
    title: 'Test Playlist',
    interval: '5m',
    items: [{ type: 'dashboard_by_uid', value: 'abc' }],
  },
};

const mockRepository: RepositoryView = {
  name: 'test-repo',
  target: 'instance' as const,
  title: 'Test Repository',
  type: 'git' as const,
  branch: 'main',
  workflows: ['write', 'branch'],
};

function mockRepoView(overrides = {}) {
  (useGetResourceRepositoryView as jest.Mock).mockReturnValue({
    repository: mockRepository,
    isLoading: false,
    isReadOnlyRepo: false,
    isMissingRepo: false,
    isInstanceManaged: true,
    status: 'ready',
    ...overrides,
  });
}

function requireCapturedRequest(req: { url: URL; body: unknown } | null): { url: URL; body: unknown } {
  expect(req).not.toBeNull();
  return req as { url: URL; body: unknown };
}

describe('SaveProvisionedPlaylistDrawer', () => {
  let capturedRequest: { url: URL; body: unknown } | null = null;

  beforeEach(() => {
    capturedRequest = null;
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockRepoView();
  });

  it('renders the drawer header, shared fields and save/cancel buttons', async () => {
    render(<SaveProvisionedPlaylistDrawer playlist={mockPlaylist} onDismiss={jest.fn()} />);

    expect(await screen.findByRole('heading', { name: /save provisioned playlist/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('commits the full playlist resource for the write workflow without a ref', async () => {
    server.use(
      http.put(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
        const url = new URL(request.url);
        capturedRequest = { url, body: await request.json() };
        return HttpResponse.json({ resource: { upsert: {} } });
      })
    );

    const { user } = render(<SaveProvisionedPlaylistDrawer playlist={mockPlaylist} onDismiss={jest.fn()} />);

    await user.click(await screen.findByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(capturedRequest).not.toBeNull();
    });

    const req = requireCapturedRequest(capturedRequest);
    expect(req.url.pathname).toContain('/repositories/test-repo/files/playlists/test-playlist.json');
    // Write workflow commits to the configured branch (no ref query param)
    expect(req.url.searchParams.get('ref')).toBeNull();
    expect(req.url.searchParams.get('message')).toBe('Save playlist: Test Playlist');
    expect(req.body).toEqual({
      apiVersion: 'playlist.grafana.app/v0alpha1',
      kind: 'Playlist',
      metadata: { name: 'playlist-uid' },
      spec: {
        title: 'Test Playlist',
        interval: '5m',
        items: [{ type: 'dashboard_by_uid', value: 'abc' }],
      },
    });
    // After a successful write-workflow save the drawer navigates back to the playlist list.
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/playlists');
    });
  });

  it('creates a new file via POST at a generated path for a new playlist', async () => {
    server.use(
      http.post(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
        const url = new URL(request.url);
        capturedRequest = { url, body: await request.json() };
        return HttpResponse.json({ resource: { upsert: {} } });
      })
    );

    const newPlaylist: Playlist = {
      apiVersion: 'playlist.grafana.app/v1',
      kind: 'Playlist',
      metadata: { name: '' },
      spec: { title: 'My New Playlist', interval: '5m', items: [{ type: 'dashboard_by_uid', value: 'xyz' }] },
    };

    const { user } = render(
      <SaveProvisionedPlaylistDrawer playlist={newPlaylist} repositoryName="test-repo" isNew onDismiss={jest.fn()} />
    );

    await user.click(await screen.findByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(capturedRequest).not.toBeNull();
    });

    const req = requireCapturedRequest(capturedRequest);
    // Path is derived from the playlist title (slugified).
    expect(req.url.pathname).toContain('/repositories/test-repo/files/my-new-playlist.json');
    expect(req.url.searchParams.get('message')).toBe('Create playlist: My New Playlist');
    // A new playlist with no name gets a generated k8s-safe name in the committed file.
    const body = req.body as { metadata?: { name?: string } };
    expect(body.metadata?.name).toMatch(/^[a-z0-9]{12}$/);
  });

  it('commits to the path the user edits in the drawer (new playlist)', async () => {
    server.use(
      http.post(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
        capturedRequest = { url: new URL(request.url), body: await request.json() };
        return HttpResponse.json({ resource: { upsert: {} } });
      })
    );

    const newPlaylist: Playlist = {
      apiVersion: 'playlist.grafana.app/v1',
      kind: 'Playlist',
      metadata: { name: '' },
      spec: { title: 'My New Playlist', interval: '5m', items: [{ type: 'dashboard_by_uid', value: 'xyz' }] },
    };

    const { user } = render(
      <SaveProvisionedPlaylistDrawer playlist={newPlaylist} repositoryName="test-repo" isNew onDismiss={jest.fn()} />
    );

    // The path field is editable for new resources (initial value is the title-derived slug);
    // the edited value must be the committed path.
    const pathInput = await screen.findByDisplayValue('my-new-playlist.json');
    await user.clear(pathInput);
    await user.type(pathInput, 'custom/folder/my-file.json');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(capturedRequest).not.toBeNull();
    });
    expect(requireCapturedRequest(capturedRequest).url.pathname).toContain(
      '/repositories/test-repo/files/custom/folder/my-file.json'
    );
  });

  it('shows the read-only banner when the repository cannot be edited', () => {
    mockRepoView({ isReadOnlyRepo: true });
    render(<SaveProvisionedPlaylistDrawer playlist={mockPlaylist} onDismiss={jest.fn()} />);

    expect(screen.queryByRole('button', { name: /^save$/i })).not.toBeInTheDocument();
  });

  it('shows the missing-repository banner when no repository resolves', () => {
    mockRepoView({ repository: undefined, isMissingRepo: true });
    render(<SaveProvisionedPlaylistDrawer playlist={mockPlaylist} onDismiss={jest.fn()} />);

    expect(screen.queryByRole('button', { name: /^save$/i })).not.toBeInTheDocument();
  });
});

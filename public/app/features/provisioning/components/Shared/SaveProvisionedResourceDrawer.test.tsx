import { HttpResponse, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type Playlist } from 'app/api/clients/playlist/v1';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { useGetResourceRepositoryView } from '../../hooks/useGetResourceRepositoryView';
import { setupProvisioningMswServer } from '../../mocks/server';

import {
  SaveProvisionedResourceDrawer,
  type SaveProvisionedResourceDrawerProps,
} from './SaveProvisionedResourceDrawer';

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

const newPlaylist: Playlist = {
  apiVersion: 'playlist.grafana.app/v1',
  kind: 'Playlist',
  metadata: { name: '' },
  spec: { title: 'My New Playlist', interval: '5m', items: [{ type: 'dashboard_by_uid', value: 'xyz' }] },
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

type CapturedRequest = { url: URL; body?: unknown; method?: string };

function requireCapturedRequest(req: CapturedRequest | null): CapturedRequest {
  expect(req).not.toBeNull();
  return req as CapturedRequest;
}

function setup(props: Partial<SaveProvisionedResourceDrawerProps> = {}) {
  const defaultProps: SaveProvisionedResourceDrawerProps = {
    resource: mockPlaylist,
    action: 'update',
    onDismiss: jest.fn(),
  };
  return render(<SaveProvisionedResourceDrawer {...defaultProps} {...props} />);
}

describe('SaveProvisionedResourceDrawer', () => {
  let capturedRequest: CapturedRequest | null = null;

  beforeEach(() => {
    capturedRequest = null;
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockRepoView();
  });

  describe('update', () => {
    it('renders the drawer header, shared fields and save/cancel buttons', async () => {
      setup();

      expect(await screen.findByRole('heading', { name: /save provisioned playlist/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /comment/i })).toBeInTheDocument();
    });

    it('commits the resource body for the write workflow and navigates to the list', async () => {
      server.use(
        http.put(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
          capturedRequest = { url: new URL(request.url), body: await request.json() };
          return HttpResponse.json({ ref: 'main', path: 'playlists/test-playlist.json', resource: { upsert: {} } });
        })
      );

      const { user } = setup();
      await user.click(await screen.findByRole('button', { name: /^save$/i }));

      await waitFor(() => expect(capturedRequest).not.toBeNull());
      const req = requireCapturedRequest(capturedRequest);
      expect(req.url.pathname).toContain('/repositories/test-repo/files/playlists/test-playlist.json');
      // Write workflow commits to the configured branch (no ref query param).
      expect(req.url.searchParams.get('ref')).toBeNull();
      expect(req.url.searchParams.get('message')).toBe('Save playlist: Test Playlist');
      // The drawer builds the committed file from the resource (apiVersion/kind/metadata/spec).
      expect(req.body).toEqual({
        apiVersion: 'playlist.grafana.app/v0alpha1',
        kind: 'Playlist',
        metadata: { name: 'playlist-uid' },
        spec: { title: 'Test Playlist', interval: '5m', items: [{ type: 'dashboard_by_uid', value: 'abc' }] },
      });
      // Default post-commit navigation goes to the kind's list route.
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/playlists'));
    });

    it('runs a caller-supplied onWriteSuccess instead of the default navigation', async () => {
      const onWriteSuccess = jest.fn();
      server.use(
        http.put(`${BASE}/repositories/:name/files/*`, () =>
          HttpResponse.json({ ref: 'main', path: 'playlists/test-playlist.json', resource: { upsert: {} } })
        )
      );

      const { user } = setup({ onWriteSuccess });
      await user.click(await screen.findByRole('button', { name: /^save$/i }));

      await waitFor(() => expect(onWriteSuccess).toHaveBeenCalled());
    });

    it('sends the ref and runs onBranchSuccess for the branch workflow', async () => {
      const onBranchSuccess = jest.fn();
      // workflows[0] === 'branch' makes the branch (PR) workflow the default.
      mockRepoView({ repository: { ...mockRepository, workflows: ['branch'] } });
      server.use(
        http.put(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
          capturedRequest = { url: new URL(request.url), body: await request.json() };
          return HttpResponse.json({
            ref: 'feature-branch',
            path: 'playlists/test-playlist.json',
            urls: { newPullRequestURL: 'https://example.com/pr/1' },
            resource: { upsert: {} },
          });
        })
      );

      const { user } = setup({ onBranchSuccess });
      await user.click(await screen.findByRole('button', { name: /^save$/i }));

      await waitFor(() => expect(capturedRequest).not.toBeNull());
      expect(requireCapturedRequest(capturedRequest).url.searchParams.get('ref')).toBeTruthy();
      await waitFor(() => expect(onBranchSuccess).toHaveBeenCalled());
    });

    it('shows an error alert when the commit fails', async () => {
      server.use(
        http.put(`${BASE}/repositories/:name/files/*`, () => HttpResponse.json({ message: 'Boom' }, { status: 500 }))
      );

      const { user } = setup();
      await user.click(await screen.findByRole('button', { name: /^save$/i }));

      await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    });

    it('shows an error when the resource has no source path to commit to', async () => {
      const { user } = setup({
        resource: {
          ...mockPlaylist,
          metadata: { annotations: { 'grafana.app/managedBy': 'repo', 'grafana.app/managerId': 'test-repo' } },
        },
      });

      await user.click(await screen.findByRole('button', { name: /^save$/i }));

      await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    });

    it('shows the read-only banner when the repository cannot be edited', () => {
      mockRepoView({ isReadOnlyRepo: true });
      setup();

      expect(screen.queryByRole('button', { name: /^save$/i })).not.toBeInTheDocument();
    });

    it('shows the missing-repository banner when no repository resolves', () => {
      mockRepoView({ repository: undefined, isMissingRepo: true });
      setup();

      expect(screen.queryByRole('button', { name: /^save$/i })).not.toBeInTheDocument();
    });
  });

  describe('create', () => {
    it('POSTs a new file at a generated path with a generated resource name', async () => {
      server.use(
        http.post(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
          capturedRequest = { url: new URL(request.url), body: await request.json() };
          return HttpResponse.json({ resource: { upsert: {} } });
        })
      );

      const { user } = setup({
        action: 'create',
        resource: newPlaylist,
        repositoryName: 'test-repo',
      });

      await user.click(await screen.findByRole('button', { name: /^save$/i }));

      await waitFor(() => expect(capturedRequest).not.toBeNull());
      const req = requireCapturedRequest(capturedRequest);
      // Path is derived from the title (slugified).
      expect(req.url.pathname).toContain('/repositories/test-repo/files/my-new-playlist.json');
      expect(req.url.searchParams.get('message')).toBe('Create playlist: My New Playlist');
      // A new resource with no name gets a generated k8s-safe name in the committed file.
      const body = req.body as { metadata?: { name?: string } };
      expect(body.metadata?.name).toMatch(/^[a-z0-9]{12}$/);
    });

    it('commits to the path the user edits in the drawer', async () => {
      server.use(
        http.post(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
          capturedRequest = { url: new URL(request.url), body: await request.json() };
          return HttpResponse.json({ resource: { upsert: {} } });
        })
      );

      const { user } = setup({
        action: 'create',
        resource: newPlaylist,
        repositoryName: 'test-repo',
      });

      // The path field is editable for new resources; the edited value must be the committed path.
      const pathInput = await screen.findByDisplayValue('my-new-playlist.json');
      await user.clear(pathInput);
      await user.type(pathInput, 'custom/folder/my-file.json');
      await user.click(screen.getByRole('button', { name: /^save$/i }));

      await waitFor(() => expect(capturedRequest).not.toBeNull());
      expect(requireCapturedRequest(capturedRequest).url.pathname).toContain(
        '/repositories/test-repo/files/custom/folder/my-file.json'
      );
    });
  });

  describe('delete', () => {
    it('renders the delete drawer with a Delete button', async () => {
      setup({ action: 'delete' });

      expect(await screen.findByRole('heading', { name: /delete provisioned playlist/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument();
    });

    it('commits the deletion via the delete-file API', async () => {
      server.use(
        http.delete(`${BASE}/repositories/:name/files/*`, ({ request }) => {
          capturedRequest = { url: new URL(request.url), method: request.method };
          return HttpResponse.json({ resource: { upsert: {} } });
        })
      );

      const { user } = setup({ action: 'delete' });
      await user.click(await screen.findByRole('button', { name: /^delete$/i }));

      await waitFor(() => expect(capturedRequest).not.toBeNull());
      const req = requireCapturedRequest(capturedRequest);
      expect(req.method).toBe('DELETE');
      expect(req.url.pathname).toContain('/repositories/test-repo/files/playlists/test-playlist.json');
      expect(req.url.searchParams.get('message')).toBe('Delete playlist: Test Playlist');
    });

    it('shows the read-only banner when the repository cannot be edited', () => {
      mockRepoView({ isReadOnlyRepo: true });
      setup({ action: 'delete' });

      expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument();
    });
  });

  it('renders nothing when the resource is not a registered provisioning kind', () => {
    // The resource's apiVersion/kind don't resolve to a registry entry, so the resolver bails out.
    setup({
      resource: {
        apiVersion: 'unknown.example.com/v1',
        kind: 'Unknown',
        metadata: { name: 'x' },
        spec: { title: 'X' },
      },
    });

    expect(screen.queryByRole('heading', { name: /provisioned/i })).not.toBeInTheDocument();
  });
});

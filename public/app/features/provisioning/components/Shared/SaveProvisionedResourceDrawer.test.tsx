import { HttpResponse, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type Playlist } from 'app/api/clients/playlist/v1';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { COMMIT_OUTCOME_STORAGE_KEY } from '../../constants';
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

type DrawerOverrides = {
  resource?: SaveProvisionedResourceDrawerProps['resource'];
  title?: string;
  action?: 'update' | 'delete';
};

function setup(props: DrawerOverrides = {}) {
  return render(
    <SaveProvisionedResourceDrawer
      resource={mockPlaylist}
      title={mockPlaylist.spec?.title ?? ''}
      action="update"
      onDismiss={jest.fn()}
      {...props}
    />
  );
}

describe('SaveProvisionedResourceDrawer', () => {
  let capturedRequest: CapturedRequest | null = null;

  beforeEach(() => {
    capturedRequest = null;
    jest.clearAllMocks();
    window.sessionStorage.clear();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockRepoView();
  });

  describe('update', () => {
    it('renders the drawer header, shared fields and commit/cancel buttons', async () => {
      setup();

      expect(await screen.findByRole('heading', { name: /save provisioned resource/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^commit/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /comment/i })).toBeInTheDocument();
    });

    it('commits the resource body for the write workflow and reports the commit in the drawer', async () => {
      server.use(
        http.put(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
          capturedRequest = { url: new URL(request.url), body: await request.json() };
          return HttpResponse.json({ path: 'playlists/test-playlist.json', resource: { upsert: {} } });
        })
      );

      const { user } = setup();
      await user.click(await screen.findByRole('button', { name: /^commit/i }));

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
      expect(await screen.findByText(/committed to main/i)).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('sends the ref and offers the pull request in the drawer for the branch workflow', async () => {
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

      const { user } = setup();
      await user.click(await screen.findByRole('button', { name: /^commit/i }));

      await waitFor(() => expect(capturedRequest).not.toBeNull());
      expect(requireCapturedRequest(capturedRequest).url.searchParams.get('ref')).toBeTruthy();
      expect(await screen.findByText(/updated in a branch/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /open pull request/i })).toHaveAttribute(
        'href',
        'https://example.com/pr/1'
      );
      expect(screen.getByText('feature-branch')).toBeInTheDocument();
    });

    it('shows an error alert when the commit fails', async () => {
      server.use(
        http.put(`${BASE}/repositories/:name/files/*`, () => HttpResponse.json({ message: 'Boom' }, { status: 500 }))
      );

      const { user } = setup();
      await user.click(await screen.findByRole('button', { name: /^commit/i }));

      await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    });

    it('shows an error when the resource has no source path to commit to', async () => {
      const { user } = setup({
        resource: {
          ...mockPlaylist,
          metadata: { annotations: { 'grafana.app/managedBy': 'repo', 'grafana.app/managerId': 'test-repo' } },
        },
      });

      await user.click(await screen.findByRole('button', { name: /^commit/i }));

      await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    });

    it('shows the read-only banner when the repository cannot be edited', () => {
      mockRepoView({ isReadOnlyRepo: true });
      setup();

      expect(screen.queryByRole('button', { name: /^commit/i })).not.toBeInTheDocument();
    });

    it('shows the missing-repository banner when no repository resolves', () => {
      mockRepoView({ repository: undefined, isMissingRepo: true });
      setup();

      expect(screen.queryByRole('button', { name: /^commit/i })).not.toBeInTheDocument();
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

      const { user } = render(
        <SaveProvisionedResourceDrawer
          resource={newPlaylist}
          title={newPlaylist.spec?.title ?? ''}
          action="create"
          repositoryName="test-repo"
          onDismiss={jest.fn()}
        />
      );

      await user.click(await screen.findByRole('button', { name: /^commit/i }));

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

      const { user } = render(
        <SaveProvisionedResourceDrawer
          resource={newPlaylist}
          title={newPlaylist.spec?.title ?? ''}
          action="create"
          repositoryName="test-repo"
          onDismiss={jest.fn()}
        />
      );

      // The path field is editable for new resources; the edited value must be the committed path.
      const pathInput = await screen.findByDisplayValue('my-new-playlist.json');
      await user.clear(pathInput);
      await user.type(pathInput, 'custom/folder/my-file.json');
      await user.click(screen.getByRole('button', { name: /^commit/i }));

      await waitFor(() => expect(capturedRequest).not.toBeNull());
      expect(requireCapturedRequest(capturedRequest).url.pathname).toContain(
        '/repositories/test-repo/files/custom/folder/my-file.json'
      );
    });
  });

  describe('delete', () => {
    it('renders the delete drawer with a Delete button', async () => {
      setup({ action: 'delete' });

      expect(await screen.findByRole('heading', { name: /delete provisioned resource/i })).toBeInTheDocument();
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

  describe('enforced branch name template', () => {
    // A write-first repo (workflows: ['write', 'branch']) that enforces a branch template must still
    // send the templated branch as `ref`: the drawer switches to the branch workflow and the
    // read-only branch field must not be dropped from the submitted ref.
    it('sends the enforced template branch as ref when saving a provisioned resource', async () => {
      mockRepoView({
        repository: {
          ...mockRepository,
          workflows: ['write', 'branch'],
          branchOptions: { enforceTemplate: true, nameTemplate: 'grafana/enforced-branch' },
        },
      });
      server.use(
        http.put(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
          capturedRequest = { url: new URL(request.url), body: await request.json() };
          return HttpResponse.json({
            ref: 'grafana/enforced-branch',
            path: 'playlists/test-playlist.json',
            resource: { upsert: {} },
          });
        })
      );

      const { user } = setup();

      const branch = await screen.findByRole('textbox', { name: /branch/i });
      await waitFor(() => expect(branch).toHaveValue('grafana/enforced-branch'));

      await user.click(screen.getByRole('button', { name: /^commit/i }));

      await waitFor(() => expect(capturedRequest).not.toBeNull());
      expect(requireCapturedRequest(capturedRequest).url.searchParams.get('ref')).toBe('grafana/enforced-branch');
    });
  });

  describe('commit outcome', () => {
    const respondWith = (body: object) =>
      server.use(http.put(`${BASE}/repositories/:name/files/*`, () => HttpResponse.json(body)));

    it('does not report a direct commit as live when Grafana has not applied it', async () => {
      respondWith({ path: 'playlists/test-playlist.json', resource: {} });

      const { user } = setup();
      await user.click(await screen.findByRole('button', { name: /^commit/i }));

      expect(await screen.findByText(/next time it syncs the repository/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'View playlist' })).not.toBeInTheDocument();
    });

    it('passes the outcome to onDismiss when the drawer closes after a commit', async () => {
      respondWith({ path: 'playlists/test-playlist.json', resource: { upsert: {} } });
      const onDismiss = jest.fn();

      const { user } = render(
        <SaveProvisionedResourceDrawer
          resource={mockPlaylist}
          title="Test Playlist"
          action="update"
          onDismiss={onDismiss}
        />
      );
      await user.click(await screen.findByRole('button', { name: /^commit/i }));
      await screen.findByText(/committed to main/i);
      await user.click(screen.getByTestId(selectors.components.Drawer.General.close));

      expect(onDismiss).toHaveBeenCalledWith(expect.objectContaining({ action: 'update' }));
    });

    it('stores the outcome for a reload until the drawer goes away', async () => {
      respondWith({ path: 'playlists/test-playlist.json', resource: { upsert: {} } });

      const { user, unmount } = setup();
      await user.click(await screen.findByRole('button', { name: /^commit/i }));
      await screen.findByText(/committed to main/i);

      expect(window.sessionStorage.getItem(COMMIT_OUTCOME_STORAGE_KEY)).not.toBeNull();
      unmount();
      expect(window.sessionStorage.getItem(COMMIT_OUTCOME_STORAGE_KEY)).toBeNull();
    });

    it('stores nothing when the drawer goes away before the commit lands', async () => {
      let respond = () => {};
      const responded = new Promise<void>((resolve) => {
        respond = resolve;
      });
      let requested = false;
      server.use(
        http.put(`${BASE}/repositories/:name/files/*`, async () => {
          requested = true;
          await responded;
          return HttpResponse.json({ path: 'playlists/test-playlist.json', resource: { upsert: {} } });
        })
      );

      const { user, unmount } = setup();
      await user.click(await screen.findByRole('button', { name: /^commit/i }));
      await waitFor(() => expect(requested).toBe(true));
      unmount();
      respond();

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(window.sessionStorage.getItem(COMMIT_OUTCOME_STORAGE_KEY)).toBeNull();
    });
  });

  it('renders nothing and warns in dev when the resource is not a registered provisioning kind', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    // The resource's apiVersion/kind don't resolve to a registry entry, so the resolver bails out.
    setup({
      title: 'X',
      resource: {
        apiVersion: 'unknown.example.com/v1',
        kind: 'Unknown',
        metadata: { name: 'x' },
        spec: { title: 'X' },
      },
    });

    expect(screen.queryByRole('heading', { name: /provisioned/i })).not.toBeInTheDocument();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('unknown.example.com/v1'));
    warnSpy.mockRestore();
  });
});

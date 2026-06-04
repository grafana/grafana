import { HttpResponse, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type Playlist } from 'app/api/clients/playlist/v1';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { type ProvisionedPlaylistDataResult, useProvisionedPlaylistData } from '../../hooks/useProvisionedPlaylistData';
import { setupProvisioningMswServer } from '../../mocks/server';

import { SaveProvisionedPlaylistForm } from './SaveProvisionedPlaylistForm';

setupProvisioningMswServer();

jest.mock('../../hooks/useProvisionedRequestHandler', () => ({
  useProvisionedRequestHandler: jest.fn(),
}));

jest.mock('../../hooks/usePRBranch', () => ({
  usePRBranch: jest.fn().mockReturnValue(undefined),
}));

jest.mock('../../hooks/useLastBranch', () => ({
  useLastBranch: jest.fn().mockReturnValue({
    getLastBranch: jest.fn().mockReturnValue(undefined),
    setLastBranch: jest.fn(),
  }),
}));

jest.mock('../../hooks/useProvisionedPlaylistData', () => ({
  useProvisionedPlaylistData: jest.fn(),
}));

jest.mock('react-router-dom-v5-compat', () => {
  const actual = jest.requireActual('react-router-dom-v5-compat');
  return {
    ...actual,
    useNavigate: () => jest.fn(),
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
  workflows: ['write', 'branch'],
};

const mockFormData = {
  repo: 'test-repo',
  path: 'playlists/test-playlist.json',
  ref: 'main',
  workflow: 'write' as const,
  comment: '',
  title: 'Test Playlist',
};

const defaultHookData: ProvisionedPlaylistDataResult = {
  repository: mockRepository,
  initialValues: mockFormData,
  isReadOnlyRepo: false,
  canPushToConfiguredBranch: true,
};

function setup(props: Partial<Parameters<typeof SaveProvisionedPlaylistForm>[0]> = {}, hookData = defaultHookData) {
  (useProvisionedPlaylistData as jest.Mock).mockReturnValue(hookData);

  const onDismiss = jest.fn();
  const defaultProps = {
    playlist: mockPlaylist,
    onDismiss,
  };

  return {
    ...render(<SaveProvisionedPlaylistForm {...defaultProps} {...props} />),
    onDismiss,
  };
}

function requireCapturedRequest(req: { url: URL; body: unknown } | null): { url: URL; body: unknown } {
  expect(req).not.toBeNull();
  return req as { url: URL; body: unknown };
}

describe('SaveProvisionedPlaylistForm', () => {
  let capturedRequest: { url: URL; body: unknown } | null = null;

  beforeEach(() => {
    capturedRequest = null;
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('rendering', () => {
    it('should render the shared fields and save/cancel buttons', async () => {
      setup();

      expect(await screen.findByRole('button', { name: /^save$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      // ResourceEditFormSharedFields renders the comment field
      expect(screen.getByRole('textbox', { name: /comment/i })).toBeInTheDocument();
    });

    it('should show read-only banner when repository is read-only', () => {
      setup({}, { ...defaultHookData, isReadOnlyRepo: true });

      expect(screen.queryByRole('button', { name: /^save$/i })).not.toBeInTheDocument();
    });

    it('should show banner when initialValues is undefined', () => {
      setup({}, { ...defaultHookData, initialValues: undefined });

      expect(screen.queryByRole('button', { name: /^save$/i })).not.toBeInTheDocument();
    });
  });

  describe('form submission', () => {
    it('should commit the full playlist resource for the write workflow without a ref', async () => {
      server.use(
        http.put(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
          const url = new URL(request.url);
          capturedRequest = { url, body: await request.json() };
          return HttpResponse.json({ resource: { upsert: {} } });
        })
      );

      const { user } = setup();

      await user.click(await screen.findByRole('button', { name: /^save$/i }));

      await waitFor(() => {
        expect(capturedRequest).not.toBeNull();
      });

      const req = requireCapturedRequest(capturedRequest);
      expect(req.url.pathname).toContain('/repositories/test-repo/files/playlists/test-playlist.json');
      // Write workflow does not send a ref query param
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
    });

    it('should send the selected branch as a ref for the branch workflow', async () => {
      server.use(
        http.put(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
          const url = new URL(request.url);
          capturedRequest = { url, body: await request.json() };
          return HttpResponse.json({ resource: { upsert: {} } });
        })
      );

      const { user } = setup(
        {},
        { ...defaultHookData, initialValues: { ...mockFormData, workflow: 'branch' as const, ref: 'my-branch' } }
      );

      await user.click(await screen.findByRole('button', { name: /^save$/i }));

      await waitFor(() => {
        expect(capturedRequest).not.toBeNull();
      });

      const req = requireCapturedRequest(capturedRequest);
      expect(req.url.searchParams.get('ref')).toBe('my-branch');
    });

    it('should use a custom commit message when a comment is provided', async () => {
      server.use(
        http.put(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
          const url = new URL(request.url);
          capturedRequest = { url, body: await request.json() };
          return HttpResponse.json({ resource: { upsert: {} } });
        })
      );

      const { user } = setup({}, { ...defaultHookData, initialValues: { ...mockFormData, comment: 'My change' } });

      await user.click(await screen.findByRole('button', { name: /^save$/i }));

      await waitFor(() => {
        expect(capturedRequest).not.toBeNull();
      });

      const req = requireCapturedRequest(capturedRequest);
      expect(req.url.searchParams.get('message')).toBe('My change');
    });

    it('should not submit when the repository is missing', async () => {
      server.use(
        http.put(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
          const url = new URL(request.url);
          capturedRequest = { url, body: await request.json() };
          return HttpResponse.json({ resource: { upsert: {} } });
        })
      );

      const { user } = setup({}, { ...defaultHookData, repository: undefined });

      await user.click(await screen.findByRole('button', { name: /^save$/i }));

      await waitFor(() => {
        expect(capturedRequest).toBeNull();
      });
    });
  });
});

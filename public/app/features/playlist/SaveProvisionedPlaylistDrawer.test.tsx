import { HttpResponse, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type Playlist } from 'app/api/clients/playlist/v1';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import {
  type ProvisionedResourceDataResult,
  useProvisionedResourceData,
} from 'app/features/provisioning/hooks/useProvisionedResourceData';
import { setupProvisioningMswServer } from 'app/features/provisioning/mocks/server';

import { SaveProvisionedPlaylistDrawer } from './SaveProvisionedPlaylistDrawer';

setupProvisioningMswServer();

jest.mock('app/features/provisioning/hooks/useProvisionedRequestHandler', () => ({
  useProvisionedRequestHandler: jest.fn(),
}));

jest.mock('app/features/provisioning/hooks/usePRBranch', () => ({
  usePRBranch: jest.fn().mockReturnValue(undefined),
}));

jest.mock('app/features/provisioning/hooks/useLastBranch', () => ({
  useLastBranch: jest.fn().mockReturnValue({
    getLastBranch: jest.fn().mockReturnValue(undefined),
    setLastBranch: jest.fn(),
  }),
}));

jest.mock('app/features/provisioning/hooks/useProvisionedResourceData', () => ({
  useProvisionedResourceData: jest.fn(),
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

const defaultHookData: ProvisionedResourceDataResult = {
  repository: mockRepository,
  initialValues: {
    repo: 'test-repo',
    path: 'playlists/test-playlist.json',
    ref: 'main',
    workflow: 'write' as const,
    comment: '',
    title: 'Test Playlist',
  },
  isReadOnlyRepo: false,
  canPushToConfiguredBranch: true,
};

function setup(hookData = defaultHookData) {
  (useProvisionedResourceData as jest.Mock).mockReturnValue(hookData);

  const onDismiss = jest.fn();
  return {
    ...render(<SaveProvisionedPlaylistDrawer playlist={mockPlaylist} onDismiss={onDismiss} />),
    onDismiss,
  };
}

describe('SaveProvisionedPlaylistDrawer', () => {
  let capturedRequest: { url: URL; body: unknown } | null = null;

  beforeEach(() => {
    capturedRequest = null;
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders inside a drawer titled for a provisioned playlist', async () => {
    setup();

    expect(await screen.findByRole('heading', { name: /save provisioned playlist/i })).toBeInTheDocument();
  });

  it('commits the full playlist resource with the default commit message', async () => {
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

    const req = capturedRequest!;
    expect(req.url.pathname).toContain('/repositories/test-repo/files/playlists/test-playlist.json');
    expect(req.url.searchParams.get('message')).toBe('Save resource: Test Playlist');
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

  it('shows the read-only banner when the repository cannot be edited', () => {
    setup({ ...defaultHookData, isReadOnlyRepo: true });

    expect(screen.queryByRole('button', { name: /^save$/i })).not.toBeInTheDocument();
  });
});

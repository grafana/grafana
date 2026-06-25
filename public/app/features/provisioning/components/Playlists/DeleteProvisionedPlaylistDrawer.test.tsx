import { HttpResponse, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type Playlist } from 'app/api/clients/playlist/v1';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { useGetResourceRepositoryView } from '../../hooks/useGetResourceRepositoryView';
import { setupProvisioningMswServer } from '../../mocks/server';

import { DeleteProvisionedPlaylistDrawer } from './DeleteProvisionedPlaylistDrawer';

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
  spec: { title: 'Test Playlist', interval: '5m', items: [{ type: 'dashboard_by_uid', value: 'abc' }] },
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

describe('DeleteProvisionedPlaylistDrawer', () => {
  let capturedRequest: { url: URL; method: string } | null = null;

  beforeEach(() => {
    capturedRequest = null;
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockRepoView();
  });

  it('renders the delete drawer with a Delete button', async () => {
    render(<DeleteProvisionedPlaylistDrawer playlist={mockPlaylist} onDismiss={jest.fn()} />);

    expect(await screen.findByRole('heading', { name: /delete provisioned playlist/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument();
  });

  it('commits the deletion via the delete-file API for the write workflow', async () => {
    server.use(
      http.delete(`${BASE}/repositories/:name/files/*`, ({ request }) => {
        capturedRequest = { url: new URL(request.url), method: request.method };
        return HttpResponse.json({ resource: { upsert: {} } });
      })
    );

    const { user } = render(<DeleteProvisionedPlaylistDrawer playlist={mockPlaylist} onDismiss={jest.fn()} />);

    await user.click(await screen.findByRole('button', { name: /^delete$/i }));

    await waitFor(() => {
      expect(capturedRequest).not.toBeNull();
    });

    expect(capturedRequest!.method).toBe('DELETE');
    expect(capturedRequest!.url.pathname).toContain('/repositories/test-repo/files/playlists/test-playlist.json');
    expect(capturedRequest!.url.searchParams.get('message')).toBe('Delete playlist: Test Playlist');
  });

  it('shows the read-only banner when the repository cannot be edited', () => {
    mockRepoView({ isReadOnlyRepo: true });
    render(<DeleteProvisionedPlaylistDrawer playlist={mockPlaylist} onDismiss={jest.fn()} />);

    expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument();
  });
});

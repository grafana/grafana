import { render, screen } from 'test/test-utils';

import { type Repository } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeyManagerIdentity, AnnoKeyManagerKind, ManagerKind } from 'app/features/apiserver/types';

import { exportResourceAsJson } from '../utils/export';

import { RepositoryListItem } from './RepositoryListItem';

jest.mock('../utils/export', () => ({ exportResourceAsJson: jest.fn() }));

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  ...jest.requireActual('app/api/clients/provisioning/v0alpha1'),
  useCreateRepositoryJobsMutation: jest.fn().mockReturnValue([jest.fn(), { isLoading: false }]),
  useListJobQuery: jest.fn().mockReturnValue({ data: undefined }),
}));

const createMockRepository = (overrides: Partial<Repository> = {}): Repository => ({
  metadata: { name: 'test-repo' },
  spec: {
    title: 'Test Repository',
    type: 'github',
    sync: { target: 'folder', enabled: true },
    workflows: [],
    github: {
      url: 'https://github.com/owner/repo',
      branch: 'main',
    },
  },
  status: {
    health: { healthy: true, checked: Date.now() },
    sync: { state: 'success', message: [] },
    observedGeneration: 1,
    webhook: {},
  },
  ...overrides,
});

describe('RepositoryListItem', () => {
  describe('repository URL display', () => {
    it('should display repository URL for GitHub repos', () => {
      render(<RepositoryListItem repository={createMockRepository()} />);

      const link = screen.getByRole('link', { name: /owner\/repo/ });
      expect(link).toHaveAttribute('href', expect.stringContaining('github.com/owner/repo'));
    });

    it('should display repository URL for GitLab repos', () => {
      const repo = createMockRepository({
        spec: {
          title: 'GitLab Repo',
          type: 'gitlab',
          gitlab: { url: 'https://gitlab.com/group/project', branch: 'main' },
          sync: { target: 'folder', enabled: true },
          workflows: [],
        },
      });
      render(<RepositoryListItem repository={repo} />);

      const link = screen.getByRole('link', { name: /group\/project/ });
      expect(link).toHaveAttribute('href', expect.stringContaining('gitlab.com/group/project'));
    });

    it('should display repository URL for Bitbucket repos', () => {
      const repo = createMockRepository({
        spec: {
          title: 'Bitbucket Repo',
          type: 'bitbucket',
          bitbucket: { url: 'https://bitbucket.org/workspace/repo', branch: 'main' },
          sync: { target: 'folder', enabled: true },
          workflows: [],
        },
      });
      render(<RepositoryListItem repository={repo} />);

      const link = screen.getByRole('link', { name: /workspace\/repo/ });
      expect(link).toHaveAttribute('href', expect.stringContaining('bitbucket.org/workspace/repo'));
    });

    it('should display repository URL for generic git repos', () => {
      const repo = createMockRepository({
        spec: {
          title: 'Git Repo',
          type: 'git',
          git: { url: 'https://git.example.com/owner/repo', branch: 'main' },
          sync: { target: 'folder', enabled: true },
          workflows: [],
        },
      });
      render(<RepositoryListItem repository={repo} />);

      const link = screen.getByRole('link', { name: /owner\/repo/ });
      expect(link).toHaveAttribute('href', expect.stringContaining('git.example.com/owner/repo'));
    });

    it('should display path for local repos instead of a link', () => {
      const repo = createMockRepository({
        spec: {
          title: 'Local Repo',
          type: 'local',
          local: { path: '/var/lib/grafana/repos/test' },
          sync: { target: 'folder', enabled: true },
          workflows: [],
        },
      });
      render(<RepositoryListItem repository={repo} />);

      expect(screen.getByText('/var/lib/grafana/repos/test')).toBeInTheDocument();
    });
  });

  describe('resource stats', () => {
    it('renders registered kinds with a friendly label linking to the repository folder', () => {
      const repo = createMockRepository({
        status: {
          health: { healthy: true, checked: Date.now() },
          sync: { state: 'success', message: [] },
          observedGeneration: 1,
          webhook: {},
          stats: [
            { group: 'dashboard.grafana.app', resource: 'dashboards', count: 2 },
            { group: 'folder.grafana.app', resource: 'folders', count: 1 },
          ],
        },
      });
      render(<RepositoryListItem repository={repo} />);

      expect(screen.getByRole('link', { name: '2 dashboards' })).toHaveAttribute('href', '/dashboards/f/test-repo');
      expect(screen.getByRole('link', { name: '1 folders' })).toHaveAttribute('href', '/dashboards/f/test-repo');
    });

    it('links non-foldered kinds to their own collection', () => {
      const repo = createMockRepository({
        status: {
          health: { healthy: true, checked: Date.now() },
          sync: { state: 'success', message: [] },
          observedGeneration: 1,
          webhook: {},
          stats: [{ group: 'playlist.grafana.app', resource: 'playlists', count: 3 }],
        },
      });
      render(<RepositoryListItem repository={repo} />);

      expect(screen.getByRole('link', { name: '3 playlists' })).toHaveAttribute('href', '/playlists');
    });

    it('links registered kinds to the top level for non-folder targets', () => {
      const repo = createMockRepository({
        spec: {
          title: 'Test Repository',
          type: 'github',
          sync: { target: 'instance', enabled: true },
          workflows: [],
        },
        status: {
          health: { healthy: true, checked: Date.now() },
          sync: { state: 'success', message: [] },
          observedGeneration: 1,
          webhook: {},
          stats: [{ group: 'dashboard.grafana.app', resource: 'dashboards', count: 2 }],
        },
      });
      render(<RepositoryListItem repository={repo} />);

      expect(screen.getByRole('link', { name: '2 dashboards' })).toHaveAttribute('href', '/dashboards');
    });

    it('renders a non-interactive badge with the raw name for unknown kinds', () => {
      const repo = createMockRepository({
        status: {
          health: { healthy: true, checked: Date.now() },
          sync: { state: 'success', message: [] },
          observedGeneration: 1,
          webhook: {},
          stats: [{ group: 'example.grafana.app', resource: 'widgets', count: 3 }],
        },
      });
      render(<RepositoryListItem repository={repo} />);

      expect(screen.queryByRole('link', { name: /widgets/ })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: '3 widgets' })).toBeDisabled();
    });
  });

  describe('export', () => {
    it('exports the repository as JSON when the Export button is clicked', async () => {
      const repo = createMockRepository();
      const { user } = render(<RepositoryListItem repository={repo} />);

      await user.click(screen.getByRole('button', { name: /export/i }));

      expect(exportResourceAsJson).toHaveBeenCalledWith(repo, 'Repository');
    });
  });

  describe('file-provisioned repositories', () => {
    const provisionedRepo = () =>
      createMockRepository({
        metadata: {
          name: 'test-repo',
          annotations: {
            [AnnoKeyManagerKind]: ManagerKind.FileProvisioning,
            [AnnoKeyManagerIdentity]: 'file-provisioning',
          },
        },
      });

    it('disables the Settings action when file-provisioned', () => {
      render(<RepositoryListItem repository={provisionedRepo()} />);

      expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute('aria-disabled', 'true');
    });

    it('keeps Settings editable for repositories that are not file-provisioned', () => {
      render(<RepositoryListItem repository={createMockRepository()} />);

      expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute('aria-disabled', 'false');
    });
  });
});

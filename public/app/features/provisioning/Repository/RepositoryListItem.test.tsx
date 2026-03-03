import { render, screen } from 'test/test-utils';

import { Repository } from 'app/api/clients/provisioning/v0alpha1';

import { RepositoryListItem } from './RepositoryListItem';

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
});

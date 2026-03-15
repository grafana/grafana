import { render, screen } from 'test/test-utils';

import { Repository } from 'app/api/clients/provisioning/v0alpha1';

import { RepositoryPullStatusCard } from './RepositoryPullStatusCard';

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
      path: 'grafana/',
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

describe('RepositoryPullStatusCard', () => {
  describe('source information display', () => {
    it('should display repository URL as a link for GitHub repos', () => {
      render(<RepositoryPullStatusCard repo={createMockRepository()} />);

      expect(screen.getByText('Repository URL:')).toBeInTheDocument();
      const link = screen.getByRole('link', { name: /owner\/repo/ });
      expect(link).toHaveAttribute('href', expect.stringContaining('github.com/owner/repo'));
    });

    it('should display branch name', () => {
      render(<RepositoryPullStatusCard repo={createMockRepository()} />);

      expect(screen.getByText('Branch:')).toBeInTheDocument();
      expect(screen.getByText('main')).toBeInTheDocument();
    });

    it('should display path when configured', () => {
      render(<RepositoryPullStatusCard repo={createMockRepository()} />);

      expect(screen.getByText('Path:')).toBeInTheDocument();
      expect(screen.getByText('grafana/')).toBeInTheDocument();
    });

    it('should not display path row when path is not set', () => {
      const repo = createMockRepository({
        spec: {
          title: 'Test',
          type: 'github',
          github: { url: 'https://github.com/owner/repo', branch: 'main' },
          sync: { target: 'folder', enabled: true },
          workflows: [],
        },
      });
      render(<RepositoryPullStatusCard repo={repo} />);

      expect(screen.queryByText('Path:')).not.toBeInTheDocument();
    });

    it('should not display URL or branch rows for local repos', () => {
      const repo = createMockRepository({
        spec: {
          title: 'Test',
          type: 'local',
          local: { path: '/var/lib/grafana/repos/test' },
          sync: { target: 'folder', enabled: true },
          workflows: [],
        },
      });
      render(<RepositoryPullStatusCard repo={repo} />);

      expect(screen.queryByText('Repository URL:')).not.toBeInTheDocument();
      expect(screen.queryByText('Branch:')).not.toBeInTheDocument();
      expect(screen.getByText('Path:')).toBeInTheDocument();
      expect(screen.getByText('/var/lib/grafana/repos/test')).toBeInTheDocument();
    });

    it('should display source info for GitLab repos', () => {
      const repo = createMockRepository({
        spec: {
          title: 'Test',
          type: 'gitlab',
          gitlab: { url: 'https://gitlab.com/group/project', branch: 'main', path: 'grafana' },
          sync: { target: 'folder', enabled: true },
          workflows: [],
        },
      });
      render(<RepositoryPullStatusCard repo={repo} />);

      expect(screen.getByText('Repository URL:')).toBeInTheDocument();
      expect(screen.getByText('Branch:')).toBeInTheDocument();
      expect(screen.getByText('Path:')).toBeInTheDocument();
    });
  });
});

import { render, screen } from 'test/test-utils';

import { type Repository, type RepositoryStatus } from 'app/api/clients/provisioning/v0alpha1';

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
  describe('last checked display', () => {
    const toLocaleString = Date.prototype.toLocaleString;

    beforeEach(() => {
      jest.spyOn(Date.prototype, 'toLocaleString').mockImplementation(function (this: Date) {
        return toLocaleString.call(this, 'en-US', { timeZone: 'UTC' });
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('updates the check time independently of the previous pull details', () => {
      const status: RepositoryStatus = {
        health: { healthy: true },
        observedGeneration: 1,
        sync: {
          state: 'warning',
          message: ['Some resources could not be synced'],
          job: 'pull-123',
          lastRef: 'abc1234567890',
          finished: Date.UTC(2026, 9, 8, 10),
          lastChecked: Date.UTC(2026, 9, 8, 11),
        },
      };
      const { rerender } = render(<RepositoryPullStatusCard repo={createMockRepository({ status })} />);

      expect(screen.getByText('Last checked:').nextElementSibling).toHaveTextContent('10/8/2026, 11:00:00 AM');
      expect(screen.getByText('Last successful pull:').nextElementSibling).toHaveTextContent('10/8/2026, 10:00:00 AM');

      rerender(
        <RepositoryPullStatusCard
          repo={createMockRepository({
            status: { ...status, sync: { ...status.sync, lastChecked: Date.UTC(2026, 9, 8, 12) } },
          })}
        />
      );

      expect(screen.getByText('Last checked:').nextElementSibling).toHaveTextContent('10/8/2026, 12:00:00 PM');
      expect(screen.getByText('Last successful pull:').nextElementSibling).toHaveTextContent('10/8/2026, 10:00:00 AM');
      expect(screen.getByText('Status:').nextElementSibling).toHaveTextContent('warning');
      expect(screen.getByText('Job ID:').nextElementSibling).toHaveTextContent('pull-123');
      expect(screen.getByRole('link', { name: 'abc1234' })).toHaveAttribute(
        'href',
        'https://github.com/owner/repo/commit/abc1234567890'
      );
      expect(screen.getByText('Some resources could not be synced')).toBeInTheDocument();
    });

    it.each([
      { name: 'missing', lastChecked: undefined },
      { name: 'zero', lastChecked: 0 },
    ])('hides a $name check time while preserving the pull completion time', ({ lastChecked }) => {
      const repo = createMockRepository({
        status: {
          health: { healthy: true },
          observedGeneration: 1,
          sync: { state: 'success', message: [], finished: Date.UTC(2026, 9, 8, 10), lastChecked },
        },
      });
      render(<RepositoryPullStatusCard repo={repo} />);

      expect(screen.getByText('Last successful pull:').nextElementSibling).toHaveTextContent('10/8/2026, 10:00:00 AM');
      expect(screen.queryByText('Last checked:')).not.toBeInTheDocument();
    });

    it('hides the check time when repository status is absent', () => {
      render(<RepositoryPullStatusCard repo={createMockRepository({ status: undefined })} />);

      expect(screen.getByText('Last successful pull:').nextElementSibling).toHaveTextContent('N/A');
      expect(screen.queryByText('Last checked:')).not.toBeInTheDocument();
    });

    it('shows the check time when the backend starts reporting it', () => {
      const status: RepositoryStatus = {
        health: { healthy: true },
        observedGeneration: 1,
        sync: { state: 'success', message: [] },
      };
      const { rerender } = render(<RepositoryPullStatusCard repo={createMockRepository({ status })} />);

      expect(screen.getByText('Status:').nextElementSibling).toHaveTextContent('success');
      expect(screen.queryByText('Last checked:')).not.toBeInTheDocument();

      rerender(
        <RepositoryPullStatusCard
          repo={createMockRepository({
            status: { ...status, sync: { ...status.sync, lastChecked: Date.UTC(2026, 9, 8, 11) } },
          })}
        />
      );

      expect(screen.getByText('Last checked:').nextElementSibling).toHaveTextContent('10/8/2026, 11:00:00 AM');
    });

    it.each([{ state: 'pending' }, { state: 'working' }] as const)(
      'displays the check time outside the busy historical section while $state',
      ({ state }) => {
        const repo = createMockRepository({
          status: {
            health: { healthy: true },
            observedGeneration: 1,
            sync: { state, message: [], lastChecked: Date.UTC(2026, 9, 8, 11) },
          },
        });
        render(<RepositoryPullStatusCard repo={repo} />);

        expect(screen.getByText('Last checked:').nextElementSibling).toHaveTextContent('10/8/2026, 11:00:00 AM');
        expect(screen.getByText('Last successful pull:').closest('[aria-busy]')).toHaveAttribute('aria-busy', 'true');
        expect(screen.getByText('10/8/2026, 11:00:00 AM').closest('[aria-busy="true"]')).toBeNull();
      }
    );
  });

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

    it('should display source info for GitHub Enterprise repos', () => {
      const repo = createMockRepository({
        spec: {
          title: 'Test',
          type: 'githubEnterprise',
          githubEnterprise: { url: 'https://ghe.example.com/owner/repo', branch: 'develop', path: 'grafana/' },
          sync: { target: 'folder', enabled: true },
          workflows: [],
        },
      });
      render(<RepositoryPullStatusCard repo={repo} />);

      expect(screen.getByText('Repository URL:')).toBeInTheDocument();
      const link = screen.getByRole('link', { name: /owner\/repo/ });
      expect(link).toHaveAttribute('href', expect.stringContaining('ghe.example.com/owner/repo'));
      expect(screen.getByText('Branch:')).toBeInTheDocument();
      expect(screen.getByText('develop')).toBeInTheDocument();
      expect(screen.getByText('Path:')).toBeInTheDocument();
      expect(screen.getByText('grafana/')).toBeInTheDocument();
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

import { render, screen, within } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { type Repository, type RepositorySpec } from 'app/api/clients/provisioning/v0alpha1';

import { RepositoryOverview } from './RepositoryOverview';

jest.mock('../Job/RecentJobs', () => ({
  RecentJobs: () => null,
}));

jest.mock('./RepositoryHealthCard', () => ({
  RepositoryHealthCard: () => null,
}));

jest.mock('./RepositoryPullStatusCard', () => ({
  RepositoryPullStatusCard: () => null,
}));

type RepositoryStatus = NonNullable<Repository['status']>;

const createMockRepository = (spec: Partial<RepositorySpec>, status: Partial<RepositoryStatus> = {}): Repository => ({
  metadata: { name: 'test-repo' },
  spec: {
    title: 'Test Repository',
    type: 'github',
    sync: { target: 'folder', enabled: true },
    workflows: [],
    ...spec,
  },
  status: {
    health: { healthy: true, checked: Date.now() },
    sync: { state: 'success', message: [] },
    observedGeneration: 1,
    webhook: { id: 42, url: 'https://grafana.example/webhook' },
    ...status,
  },
});

const resourcesCard = () => within(screen.getByTestId(selectors.pages.Provisioning.RepositoryOverview.resourcesCard));

describe('RepositoryOverview', () => {
  it('shows the missing folder metadata warning when the repository reports it', () => {
    const repo = createMockRepository(
      {},
      {
        conditions: [
          {
            type: 'PullStatus',
            status: 'False',
            reason: 'MissingFolderMetadata',
            message: 'Folder metadata is missing',
            lastTransitionTime: new Date().toISOString(),
            observedGeneration: 1,
          },
        ],
      }
    );

    render(<RepositoryOverview repo={repo} />);

    expect(screen.getByText('Some folders are missing metadata in this repository.')).toBeInTheDocument();
  });

  it('badges the save workflows next to the Resources heading', async () => {
    const { user } = render(
      <RepositoryOverview
        repo={createMockRepository({
          workflows: ['write', 'branch'],
          github: { url: 'https://github.com/o/r', branch: 'main' },
        })}
      />
    );

    expect(screen.getByText('Direct push')).toBeInTheDocument();
    await user.hover(screen.getByText('Pull request'));
    expect(
      await screen.findByText('Changes are saved to another branch, ready for you to open a pull request into main.')
    ).toBeInTheDocument();
  });

  it('badges a repository with no workflows as read only', () => {
    render(<RepositoryOverview repo={createMockRepository({ workflows: [] })} />);

    expect(screen.getByText('Read only')).toBeInTheDocument();
  });

  it('tells the user when the repository manages nothing yet', () => {
    render(<RepositoryOverview repo={createMockRepository({}, { stats: [] })} />);

    expect(screen.getByText('No resources are managed by this repository yet.')).toBeInTheDocument();
  });

  it('summarises the totals and keeps every kind in the list, largest first', () => {
    const stats = Array.from({ length: 12 }, (_, index) => ({
      group: `kind-${index}.grafana.app`,
      resource: `kind-${index}`,
      count: index + 1,
    }));

    render(<RepositoryOverview repo={createMockRepository({}, { stats })} />);

    expect(screen.getByText('78 resources across 12 kinds')).toBeInTheDocument();

    // The list scrolls rather than paginating, so every kind stays in the document.
    const kinds = resourcesCard().getAllByRole('link');
    expect(kinds).toHaveLength(12);
    expect(kinds.map((kind) => kind.textContent)).toEqual([
      'kind-11',
      'kind-10',
      'kind-9',
      'kind-8',
      'kind-7',
      'kind-6',
      'kind-5',
      'kind-4',
      'kind-3',
      'kind-2',
      'kind-1',
      'kind-0',
    ]);
  });

  it('sorts equal counts alphabetically by kind label', () => {
    const repo = createMockRepository(
      {},
      {
        stats: [
          { group: 'example.grafana.app', resource: 'widgets', count: 5 },
          { group: 'dashboard.grafana.app', resource: 'dashboards', count: 5 },
        ],
      }
    );

    render(<RepositoryOverview repo={repo} />);

    expect(
      resourcesCard()
        .getAllByRole('link')
        .map((kind) => kind.textContent)
    ).toEqual(['Dashboard', 'widgets']);
  });

  it('links each kind label to the resources tab filtered by that kind', () => {
    const repo = createMockRepository(
      {},
      {
        stats: [
          { group: 'dashboard.grafana.app', resource: 'dashboards', count: 2 },
          { group: 'example.grafana.app', resource: 'widgets', count: 3 },
        ],
      }
    );

    render(<RepositoryOverview repo={repo} />);

    expect(resourcesCard().getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'href',
      '/admin/provisioning/test-repo?tab=resources&resource=dashboards'
    );
    expect(resourcesCard().getByRole('link', { name: 'widgets' })).toHaveAttribute(
      'href',
      '/admin/provisioning/test-repo?tab=resources&resource=widgets'
    );
  });

  describe('webhook link', () => {
    it('should link to GitHub webhook settings for github repositories', () => {
      const repo = createMockRepository({
        type: 'github',
        github: { url: 'https://github.com/org/repo', branch: 'main' },
      });
      render(<RepositoryOverview repo={repo} />);

      expect(screen.getByRole('link', { name: 'View Webhook' })).toHaveAttribute(
        'href',
        'https://github.com/org/repo/settings/hooks/42'
      );
    });

    it('should link to GitHub webhook settings for githubEnterprise repositories', () => {
      const repo = createMockRepository({
        type: 'githubEnterprise',
        githubEnterprise: { url: 'https://github.example.com/org/repo', branch: 'main' },
      });
      render(<RepositoryOverview repo={repo} />);

      expect(screen.getByRole('link', { name: 'View Webhook' })).toHaveAttribute(
        'href',
        'https://github.example.com/org/repo/settings/hooks/42'
      );
    });

    it('should link to GitLab webhook settings for gitlab repositories', () => {
      const repo = createMockRepository({
        type: 'gitlab',
        gitlab: { url: 'https://gitlab.com/org/repo', branch: 'main' },
      });
      render(<RepositoryOverview repo={repo} />);

      expect(screen.getByRole('link', { name: 'View Webhook' })).toHaveAttribute(
        'href',
        'https://gitlab.com/org/repo/-/hooks/42/edit'
      );
    });

    it('should link to Bitbucket webhook settings for bitbucket repositories', () => {
      const repo = createMockRepository(
        {
          type: 'bitbucket',
          bitbucket: { url: 'https://bitbucket.org/org/repo', branch: 'main' },
        },
        { webhook: { uuid: '{9a41cbfa-9b26-45f6-8b1a-ce8f7c78b6f0}', url: 'https://grafana.example/webhook' } }
      );
      render(<RepositoryOverview repo={repo} />);

      expect(screen.getByRole('link', { name: 'View Webhook' })).toHaveAttribute(
        'href',
        'https://bitbucket.org/org/repo/admin/webhooks/%7B9a41cbfa-9b26-45f6-8b1a-ce8f7c78b6f0%7D/edit'
      );
    });

    it('should display the webhook UUID without braces for bitbucket repositories', () => {
      const repo = createMockRepository(
        {
          type: 'bitbucket',
          bitbucket: { url: 'https://bitbucket.org/org/repo', branch: 'main' },
        },
        { webhook: { uuid: '{9a41cbfa-9b26-45f6-8b1a-ce8f7c78b6f0}', url: 'https://grafana.example/webhook' } }
      );
      render(<RepositoryOverview repo={repo} />);

      expect(screen.getByText('9a41cbfa-9b26-45f6-8b1a-ce8f7c78b6f0')).toBeInTheDocument();
    });

    it('should not render the webhook link for repositories without webhook support', () => {
      const repo = createMockRepository({ type: 'local', local: { path: '/tmp/repo' } });
      render(<RepositoryOverview repo={repo} />);

      expect(screen.queryByRole('link', { name: 'View Webhook' })).not.toBeInTheDocument();
    });
  });
});

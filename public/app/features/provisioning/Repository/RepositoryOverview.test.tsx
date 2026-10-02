import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { render, screen } from 'test/test-utils';

import { type Condition, type Repository, type RepositorySpec } from 'app/api/clients/provisioning/v0alpha1';

import { RepositoryOverview } from './RepositoryOverview';

jest.mock('@openfeature/react-sdk', () => ({
  ...jest.requireActual('@openfeature/react-sdk'),
  useBooleanFlagValue: jest.fn().mockReturnValue(false),
}));

const mockUseBooleanFlagValue = useBooleanFlagValue as jest.MockedFunction<typeof useBooleanFlagValue>;

jest.mock('../Job/RecentJobs', () => ({
  RecentJobs: () => null,
}));

jest.mock('./RepositoryHealthCard', () => ({
  RepositoryHealthCard: () => null,
}));

jest.mock('./RepositoryPullStatusCard', () => ({
  RepositoryPullStatusCard: () => null,
}));

const createMockRepository = (
  spec: Partial<RepositorySpec>,
  webhook: NonNullable<Repository['status']>['webhook'] = { id: 42, url: 'https://grafana.example/webhook' },
  conditions?: Condition[]
): Repository => ({
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
    webhook,
    conditions,
  },
});

describe('RepositoryOverview', () => {
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
        { uuid: '{9a41cbfa-9b26-45f6-8b1a-ce8f7c78b6f0}', url: 'https://grafana.example/webhook' }
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
        { uuid: '{9a41cbfa-9b26-45f6-8b1a-ce8f7c78b6f0}', url: 'https://grafana.example/webhook' }
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

  describe('path conflict warning', () => {
    const pathConflictCondition: Condition = {
      type: 'PathConflict',
      status: 'False',
      reason: 'PathConflict',
      message: 'repository path conflicts with existing repository: other-repo',
      lastTransitionTime: '2024-01-01T00:00:00Z',
    };
    const noPathConflictCondition: Condition = {
      type: 'PathConflict',
      status: 'True',
      reason: 'NoPathConflict',
      message: 'no other repository shares this URL, branch, and path',
      lastTransitionTime: '2024-01-01T00:00:00Z',
    };

    it('should render the banner when the repository has a PathConflict condition', () => {
      const repo = createMockRepository({}, undefined, [pathConflictCondition]);
      render(<RepositoryOverview repo={repo} />);

      expect(
        screen.getByText(
          'This repository shares a url, branch, and path combination with another repository. There will be sync errors because resources can only be managed by 1 repository.'
        )
      ).toBeInTheDocument();
      expect(screen.getByText('repository path conflicts with existing repository: other-repo')).toBeInTheDocument();
    });

    it('should not render the banner when there is no conflict', () => {
      const repo = createMockRepository({}, undefined, [noPathConflictCondition]);
      render(<RepositoryOverview repo={repo} />);

      expect(
        screen.queryByText(
          'This repository shares a url, branch, and path combination with another repository. There will be sync errors because resources can only be managed by 1 repository.'
        )
      ).not.toBeInTheDocument();
    });

    it('should not render the banner when the repository has no conditions', () => {
      const repo = createMockRepository({}, undefined, undefined);
      render(<RepositoryOverview repo={repo} />);

      expect(
        screen.queryByText(
          'This repository shares a url, branch, and path combination with another repository. There will be sync errors because resources can only be managed by 1 repository.'
        )
      ).not.toBeInTheDocument();
    });

    it('should render alongside the missing-folder-metadata banner - neither replaces the other', () => {
      mockUseBooleanFlagValue.mockReturnValue(true);
      const repo = createMockRepository({}, undefined, [
        pathConflictCondition,
        {
          type: 'PullStatus',
          status: 'False',
          reason: 'MissingFolderMetadata',
          message: 'missing folder metadata',
          lastTransitionTime: '2024-01-01T00:00:00Z',
        },
      ]);
      render(<RepositoryOverview repo={repo} />);

      expect(
        screen.getByText(
          'This repository shares a url, branch, and path combination with another repository. There will be sync errors because resources can only be managed by 1 repository.'
        )
      ).toBeInTheDocument();
      expect(screen.getByText('Some folders are missing metadata in this repository.')).toBeInTheDocument();
    });
  });
});

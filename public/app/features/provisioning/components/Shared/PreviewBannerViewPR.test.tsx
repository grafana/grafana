import { render, screen, within } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { type RepoType } from 'app/features/provisioning/Wizard/types';
import { usePullRequestParam } from 'app/features/provisioning/hooks/usePullRequestParam';

import { isValidRepoType } from '../../guards';
import { setupProvisioningMswServer } from '../../mocks/server';

import { PreviewBannerViewPR, type PreviewBranchInfo } from './PreviewBannerViewPR';

jest.mock('app/features/provisioning/hooks/usePullRequestParam', () => ({
  usePullRequestParam: jest.fn(),
}));

const mockUsePullRequestParam = jest.mocked(usePullRequestParam);

setupProvisioningMswServer();

function setup(
  options: {
    prURL?: string;
    isNewPr?: boolean;
    repoType?: RepoType;
    action?: string;
    prTitle?: string;
    branchInfo?: PreviewBranchInfo;
    originalUrl?: string;
    behindBranch?: boolean;
    repoUrl?: string;
  } = {
    prURL: 'test-url',
    repoType: 'github',
  }
) {
  const componentProps = {
    prURL: options.prURL,
    isNewPr: options.isNewPr || false,
    branchInfo: options.branchInfo,
    originalUrl: options.originalUrl,
    behindBranch: options.behindBranch,
    repoUrl: options.repoUrl,
  };

  mockUsePullRequestParam.mockReturnValue({
    prURL: undefined,
    newPrURL: undefined,
    repoURL: undefined,
    repoType: options.repoType || 'github',
    resourcePushedTo: 'abc',
    action: options.action,
    prTitle: options.prTitle,
  });

  return { ...render(<PreviewBannerViewPR {...componentProps} />), props: componentProps };
}

describe('PreviewBannerViewPR', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Dashboard scenarios', () => {
    it('should render correct text for new PR dashboard', () => {
      setup({ prURL: 'test-url', isNewPr: true });

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('A new resource has been created in a branch in GitHub.')).toBeInTheDocument();
    });

    it('should render correct text for existing PR dashboard', () => {
      setup({ prURL: 'test-url', isNewPr: false });

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(
        screen.getByText(
          'The rest of Grafana users in your organization will still see the current version saved to configured default branch until this branch is merged'
        )
      ).toBeInTheDocument();
    });

    it('should render correct button text for new PR dashboard', () => {
      setup({ prURL: 'test-url', isNewPr: true });

      expect(screen.getByText('Open pull request in GitHub')).toBeInTheDocument();
    });

    it('should render correct button text for existing PR dashboard', () => {
      setup({ prURL: 'test-url', isNewPr: false });

      expect(screen.getByText('View pull request in GitHub')).toBeInTheDocument();
    });
  });

  describe('Additional scenarios', () => {
    it('should render correct text for new PR resource', () => {
      setup({ prURL: 'test-url', isNewPr: true });

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('A new resource has been created in a branch in GitHub.')).toBeInTheDocument();
    });

    it('should render correct text for existing PR resource', () => {
      setup({ prURL: 'test-url', isNewPr: false });

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(
        screen.getByText(
          'This resource is loaded from the branch you just created in GitHub and it is only visible to you'
        )
      ).toBeInTheDocument();
    });

    it('should render correct button text for new PR resource', () => {
      setup({ prURL: 'test-url', isNewPr: true });

      expect(screen.getByText('Open pull request in GitHub')).toBeInTheDocument();
    });

    it('should render correct button text for existing PR resource', () => {
      setup({ prURL: 'test-url', isNewPr: false });

      expect(screen.getByText('View pull request in GitHub')).toBeInTheDocument();
    });
  });

  describe('Saved version action', () => {
    it('should render a link to the saved version when originalUrl is provided', () => {
      setup({ prURL: 'test-url', isNewPr: false, originalUrl: '/d/original-uid' });

      const link = screen.getByRole('link', { name: 'View saved version' });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/d/original-uid');
    });

    it('should not render the link when originalUrl is not provided', () => {
      setup({ prURL: 'test-url', isNewPr: false });

      expect(screen.queryByRole('link', { name: 'View saved version' })).not.toBeInTheDocument();
    });
  });

  describe('Behind branch', () => {
    // This is the variant the provisioned folder banner renders, and it has its own Alert.
    it('should link to the repository in a new tab', () => {
      const repoUrl = 'https://github.com/org/repo';
      setup({ behindBranch: true, repoUrl });

      expect(screen.getByText('This resource is behind the branch in GitHub.')).toBeInTheDocument();

      const link = screen.getByRole('link', { name: /Open in GitHub/i });
      expect(link).toHaveAttribute('href', repoUrl);
      expect(link).toHaveAttribute('target', '_blank');
    });

    it('should not render the action when no repo url is available', () => {
      setup({ behindBranch: true });

      expect(screen.getByText('This resource is behind the branch in GitHub.')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Open in GitHub/i })).not.toBeInTheDocument();
    });
  });

  describe('Button functionality', () => {
    it('should link to the pull request URL in a new tab', () => {
      const testUrl = 'https://GitHub.com/test/repo/pull/123';
      setup({ prURL: testUrl });

      const link = screen.getByRole('link', { name: /pull request in GitHub/i });
      expect(link).toHaveAttribute('href', testUrl);
      expect(link).toHaveAttribute('target', '_blank');
    });
  });

  describe('Different repository types', () => {
    it('should handle GitLab repository type', () => {
      setup({ prURL: 'test-url', isNewPr: false, repoType: 'gitlab' });

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(
        screen.getByText(
          'This resource is loaded from the branch you just created in GitLab and it is only visible to you'
        )
      ).toBeInTheDocument();
    });

    it('should handle Bitbucket repository type', () => {
      setup({ prURL: 'test-url', isNewPr: false, repoType: 'bitbucket' });

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(
        screen.getByText(
          'This resource is loaded from the branch you just created in Bitbucket and it is only visible to you'
        )
      ).toBeInTheDocument();
    });
  });

  describe('Delete action', () => {
    it('should render delete-specific title for new PR', () => {
      setup({ prURL: 'test-url', isNewPr: true, action: 'delete' });

      expect(screen.getByText('A resource has been deleted in a branch in GitHub.')).toBeInTheDocument();
    });

    it('should render delete-specific body text', () => {
      setup({ prURL: 'test-url', isNewPr: true, action: 'delete' });

      expect(
        screen.getByText(
          'The rest of Grafana users in your organization will still see this resource until this branch is merged'
        )
      ).toBeInTheDocument();
    });

    it('should still render PR button for delete action', () => {
      setup({ prURL: 'test-url', isNewPr: true, action: 'delete' });

      expect(screen.getByText('Open pull request in GitHub')).toBeInTheDocument();
    });
  });

  describe('Branch information', () => {
    const branchInfo: PreviewBranchInfo = {
      repoBaseUrl: 'https://github.com/org/repo',
      targetBranch: 'dashboard/2026-08-20-abcde',
      configuredBranch: 'develop',
    };

    it('renders source and target branch pills with stable selectors', () => {
      setup({ prURL: 'test-url', isNewPr: true, repoType: 'github', branchInfo });

      const source = screen.getByTestId(selectors.pages.Provisioning.PreviewBanner.sourceBranchLink);
      const target = screen.getByTestId(selectors.pages.Provisioning.PreviewBanner.targetBranchLink);

      expect(source).toHaveTextContent('dashboard/2026-08-20-abcde');
      expect(within(source).getByRole('link')).toHaveAttribute(
        'href',
        'https://github.com/org/repo/tree/dashboard/2026-08-20-abcde'
      );
      expect(target).toHaveTextContent('develop');
      expect(within(target).getByRole('link')).toHaveAttribute('href', 'https://github.com/org/repo/tree/develop');
    });

    it('exposes the branch-direction arrow to assistive technology', () => {
      setup({ prURL: 'test-url', isNewPr: true, repoType: 'github', branchInfo });

      expect(screen.getByLabelText('targets')).toBeInTheDocument();
    });
  });

  describe('PR title prefill', () => {
    const githubPrURL = 'https://github.com/org/repo/compare/main...feature?quick_pull=1&labels=grafana';

    it('appends an encoded title param to a GitHub PR URL when pr_title is present', () => {
      setup({ prURL: githubPrURL, repoType: 'github', prTitle: 'update: My Dashboard' });

      expect(screen.getByRole('link', { name: /pull request in GitHub/i })).toHaveAttribute(
        'href',
        `${githubPrURL}&title=update%3A%20My%20Dashboard`
      );
    });

    it('uses merge_request[title] for GitLab', () => {
      const gitlabPrURL = 'https://gitlab.com/org/repo/-/merge_requests/new?merge_request[source_branch]=feature';
      setup({ prURL: gitlabPrURL, repoType: 'gitlab', prTitle: 'update: My Dashboard' });

      expect(screen.getByRole('link', { name: /pull request in GitLab/i })).toHaveAttribute(
        'href',
        `${gitlabPrURL}&merge_request[title]=update%3A%20My%20Dashboard`
      );
    });

    it('leaves the PR URL unchanged when no pr_title is present', () => {
      setup({ prURL: githubPrURL, repoType: 'github' });

      expect(screen.getByRole('link', { name: /pull request in GitHub/i })).toHaveAttribute('href', githubPrURL);
    });
  });
});

describe('isValidRepoType', () => {
  it('should return true for valid repo types', () => {
    expect(isValidRepoType('github')).toBe(true);
    expect(isValidRepoType('gitlab')).toBe(true);
    expect(isValidRepoType('bitbucket')).toBe(true);
    expect(isValidRepoType('git')).toBe(true);
  });

  it('should return false for invalid repo types', () => {
    expect(isValidRepoType('unknown')).toBe(false);
    expect(isValidRepoType('apple')).toBe(false);
    expect(isValidRepoType('')).toBe(false);
    expect(isValidRepoType(undefined)).toBe(false);
    // @ts-expect-error testing invalid type
    expect(isValidRepoType(null)).toBe(false);
  });
});

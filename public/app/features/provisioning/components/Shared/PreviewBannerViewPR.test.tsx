import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { type RepoType } from 'app/features/provisioning/Wizard/types';
import { usePullRequestParam } from 'app/features/provisioning/hooks/usePullRequestParam';

import { isValidRepoType } from '../../guards';

import { PreviewBannerViewPR } from './PreviewBannerViewPR';

jest.mock('app/features/provisioning/hooks/usePullRequestParam', () => ({
  usePullRequestParam: jest.fn(),
}));

const mockUsePullRequestParam = jest.mocked(usePullRequestParam);

function setup(
  options: {
    prURL?: string;
    isNewPr?: boolean;
    repoType?: RepoType;
    action?: string;
    prTitle?: string;
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

  const renderResult = render(<PreviewBannerViewPR {...componentProps} />);

  return { renderResult, props: componentProps };
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

  describe('onOpenPullRequest override', () => {
    beforeEach(() => {
      mockUsePullRequestParam.mockReturnValue({
        prURL: undefined,
        newPrURL: undefined,
        repoURL: undefined,
        repoType: 'github',
        resourcePushedTo: 'abc',
        action: undefined,
        prTitle: undefined,
      });
    });

    it('renders a click handler that opens a tab synchronously and hands the caller open/cancel', async () => {
      const user = userEvent.setup();
      const onOpenPullRequest = jest.fn();
      const pendingTab = { location: { href: '' }, close: jest.fn() };
      const openSpy = jest.spyOn(window, 'open').mockReturnValue(pendingTab as unknown as Window);

      render(
        <PreviewBannerViewPR
          isNewPr
          prURL="https://github.com/org/repo/compare"
          onOpenPullRequest={onOpenPullRequest}
        />
      );

      // With the override present the primary action is a button, not a link.
      expect(screen.queryByRole('link', { name: /pull request in GitHub/i })).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /Open pull request in GitHub/i }));

      // The tab is opened within the click gesture, before the async check runs.
      expect(openSpy).toHaveBeenCalledWith('about:blank', '_blank');
      expect(onOpenPullRequest).toHaveBeenCalledTimes(1);

      const actions = onOpenPullRequest.mock.calls[0][0];
      // open() navigates the pre-opened tab to the computed link.
      actions.open();
      expect(pendingTab.location.href).toBe('https://github.com/org/repo/compare');
      // cancel() closes it.
      actions.cancel();
      expect(pendingTab.close).toHaveBeenCalledTimes(1);

      openSpy.mockRestore();
    });

    it('shows a checking state on the button while pre-flighting', () => {
      render(
        <PreviewBannerViewPR
          isNewPr
          prURL="https://github.com/org/repo/compare"
          onOpenPullRequest={jest.fn()}
          isCheckingBranch
        />
      );

      expect(screen.getByRole('button', { name: 'Checking branch…' })).toBeInTheDocument();
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

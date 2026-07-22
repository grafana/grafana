import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { textUtil } from '@grafana/data';
import { type RepoType } from 'app/features/provisioning/Wizard/types';
import { usePullRequestParam } from 'app/features/provisioning/hooks/usePullRequestParam';

import { isValidRepoType } from '../../guards';

import { PreviewBannerViewPR } from './PreviewBannerViewPR';

jest.mock('@grafana/data', () => ({
  ...jest.requireActual('@grafana/data'),
  textUtil: {
    sanitizeUrl: jest.fn(),
  },
}));

jest.mock('app/features/provisioning/hooks/usePullRequestParam', () => ({
  usePullRequestParam: jest.fn(),
}));

const mockTextUtil = jest.mocked(textUtil);

const mockUsePullRequestParam = jest.mocked(usePullRequestParam);

function setup(
  options: { prURL: string; isNewPr?: boolean; repoType?: RepoType; action?: string; prTitle?: string } = {
    prURL: 'test-url',
    repoType: 'github',
  }
) {
  const componentProps = {
    prURL: options.prURL,
    isNewPr: options.isNewPr || false,
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
  let windowOpenSpy: jest.SpyInstance;

  beforeAll(() => {
    Object.defineProperty(window, 'open', {
      writable: true,
      value: jest.fn(),
    });
    windowOpenSpy = jest.spyOn(window, 'open');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockTextUtil.sanitizeUrl.mockImplementation((url) => url);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    windowOpenSpy.mockRestore();
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

      expect(screen.getByText('Open a pull request in GitHub')).toBeInTheDocument();
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

      expect(screen.getByText('Open a pull request in GitHub')).toBeInTheDocument();
    });

    it('should render correct button text for existing PR resource', () => {
      setup({ prURL: 'test-url', isNewPr: false });

      expect(screen.getByText('View pull request in GitHub')).toBeInTheDocument();
    });
  });

  describe('Button functionality', () => {
    it('should open URL in new tab when button is clicked', async () => {
      const testUrl = 'https://GitHub.com/test/repo/pull/123';
      setup({ prURL: testUrl });

      const button = screen.getByRole('button', { name: /close alert/i });
      await userEvent.click(button);

      expect(windowOpenSpy).toHaveBeenCalledWith(testUrl, '_blank');
    });
  });

  describe('Link fallback', () => {
    it('falls back to the branch URL when no PR/compare URL is available', async () => {
      mockUsePullRequestParam.mockReturnValue({
        prURL: undefined,
        newPrURL: undefined,
        repoURL: undefined,
        repoType: 'github',
        resourcePushedTo: 'abc',
        action: undefined,
        prTitle: undefined,
      });

      render(
        <PreviewBannerViewPR
          isNewPr
          branchInfo={{
            targetBranch: 'feature',
            configuredBranch: 'main',
            repoBaseUrl: 'https://github.com/org/repo',
          }}
        />
      );

      await userEvent.click(screen.getByRole('button', { name: /close alert/i }));

      expect(windowOpenSpy).toHaveBeenCalledWith('https://github.com/org/repo/tree/feature', '_blank');
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

    it('runs the override instead of opening the link directly', async () => {
      const onOpenPullRequest = jest.fn();
      render(
        <PreviewBannerViewPR
          isNewPr
          prURL="https://github.com/org/repo/compare"
          onOpenPullRequest={onOpenPullRequest}
        />
      );

      await userEvent.click(screen.getByRole('button', { name: /close alert/i }));

      expect(onOpenPullRequest).toHaveBeenCalledTimes(1);
      expect(windowOpenSpy).not.toHaveBeenCalled();

      // The override receives a fallback that opens the computed link when invoked.
      onOpenPullRequest.mock.calls[0][0]();
      expect(windowOpenSpy).toHaveBeenCalledWith('https://github.com/org/repo/compare', '_blank');
    });

    it('shows a checking state on the button while pre-flighting', () => {
      render(<PreviewBannerViewPR isNewPr prURL="https://github.com/org/repo/compare" isCheckingBranch />);

      expect(screen.getByText('Checking branch…')).toBeInTheDocument();
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

      expect(screen.getByText('Open a pull request in GitHub')).toBeInTheDocument();
    });
  });

  describe('PR title prefill', () => {
    const githubPrURL = 'https://github.com/org/repo/compare/main...feature?quick_pull=1&labels=grafana';

    it('appends an encoded title param to a GitHub PR URL when pr_title is present', async () => {
      setup({ prURL: githubPrURL, repoType: 'github', prTitle: 'update: My Dashboard' });

      await userEvent.click(screen.getByRole('button', { name: /close alert/i }));

      expect(windowOpenSpy).toHaveBeenCalledWith(`${githubPrURL}&title=update%3A%20My%20Dashboard`, '_blank');
    });

    it('uses merge_request[title] for GitLab', async () => {
      const gitlabPrURL = 'https://gitlab.com/org/repo/-/merge_requests/new?merge_request[source_branch]=feature';
      setup({ prURL: gitlabPrURL, repoType: 'gitlab', prTitle: 'update: My Dashboard' });

      await userEvent.click(screen.getByRole('button', { name: /close alert/i }));

      expect(windowOpenSpy).toHaveBeenCalledWith(
        `${gitlabPrURL}&merge_request[title]=update%3A%20My%20Dashboard`,
        '_blank'
      );
    });

    it('leaves the PR URL unchanged when no pr_title is present', async () => {
      setup({ prURL: githubPrURL, repoType: 'github' });

      await userEvent.click(screen.getByRole('button', { name: /close alert/i }));

      expect(windowOpenSpy).toHaveBeenCalledWith(githubPrURL, '_blank');
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

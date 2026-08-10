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
  options: {
    prURL?: string;
    isNewPr?: boolean;
    repoType?: RepoType;
    action?: string;
    prTitle?: string;
    repoUrl?: string;
  } = {
    prURL: 'test-url',
    repoType: 'github',
  }
) {
  const componentProps = {
    prURL: options.prURL,
    isNewPr: options.isNewPr || false,
    repoUrl: options.repoUrl,
  };

  mockUsePullRequestParam.mockReturnValue({
    prURL: undefined,
    newPrURL: undefined,
    repoURL: undefined,
    // Allow explicit undefined (missing repo_type query param) — don't coerce to github.
    repoType: 'repoType' in options ? options.repoType : 'github',
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

  describe('Button functionality', () => {
    it('should open URL in new tab when button is clicked', async () => {
      const testUrl = 'https://GitHub.com/test/repo/pull/123';
      setup({ prURL: testUrl });

      const button = screen.getByRole('button', { name: /close alert/i });
      await userEvent.click(button);

      expect(windowOpenSpy).toHaveBeenCalledWith(testUrl, '_blank');
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

    it('should keep Open pull request label for GitLab when a PR URL is present', () => {
      setup({ prURL: 'test-url', isNewPr: true, repoType: 'gitlab' });

      expect(screen.getByText('Open pull request in GitLab')).toBeInTheDocument();
      expect(screen.queryByText(/cannot open pull requests from Grafana/i)).not.toBeInTheDocument();
    });

    it('should use Open in Git and show the no-PR hint for pure git', () => {
      setup({ prURL: 'https://git.example.com/org/repo', isNewPr: true, repoType: 'git' });

      expect(screen.getByText('Open in Git')).toBeInTheDocument();
      expect(screen.queryByText('Open pull request in Git')).not.toBeInTheDocument();
      expect(screen.queryByText('View pull request in Git')).not.toBeInTheDocument();
      // Body has no trailing period; join must insert one before the hint sentence.
      expect(
        screen.getByText(
          /until this branch is merged\. This connection cannot open pull requests from Grafana/i
        )
      ).toBeInTheDocument();
    });

    it('should not show the no-PR hint for GitHub when the PR URL is missing', () => {
      setup({
        prURL: undefined,
        isNewPr: true,
        repoType: 'github',
        repoUrl: 'https://github.com/org/repo',
      });

      expect(screen.getByText('Open in GitHub')).toBeInTheDocument();
      expect(screen.queryByText('Open pull request in GitHub')).not.toBeInTheDocument();
      expect(screen.queryByText(/cannot open pull requests from Grafana/i)).not.toBeInTheDocument();
    });

    it('should not show the no-PR hint when repoType is missing', () => {
      setup({
        prURL: undefined,
        isNewPr: true,
        repoType: undefined,
        repoUrl: 'https://example.com/org/repo',
      });

      expect(screen.getByText('Open in repository')).toBeInTheDocument();
      expect(screen.queryByText(/cannot open pull requests from Grafana/i)).not.toBeInTheDocument();
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

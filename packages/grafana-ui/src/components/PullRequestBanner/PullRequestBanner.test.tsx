import { render, screen } from '@testing-library/react';

import { PullRequestBanner, type PullRequestBannerBranchInfo } from './PullRequestBanner';

function branchInfo(repoBaseUrl: string): PullRequestBannerBranchInfo {
  return { targetBranch: 'feature/foo', configuredBranch: 'main', repoBaseUrl };
}

describe('PullRequestBanner', () => {
  it('names the provider and links to the pull request with its title', () => {
    render(
      <PullRequestBanner
        prURL="https://github.com/org/repo/compare/main...feature/foo"
        isNewPr
        repoType="github"
        prTitle="Add widget"
      />
    );

    expect(screen.getByText('A new resource has been created in a branch in GitHub.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open pull request in GitHub/ })).toHaveAttribute(
      'href',
      'https://github.com/org/repo/compare/main...feature/foo?title=Add%20widget'
    );
  });

  it('uses the GitLab title parameter', () => {
    render(
      <PullRequestBanner
        prURL="https://gitlab.com/org/repo/-/merge_requests/new"
        isNewPr
        repoType="gitlab"
        prTitle="Fix"
      />
    );

    expect(screen.getByRole('link', { name: /Open pull request in GitLab/ })).toHaveAttribute(
      'href',
      'https://gitlab.com/org/repo/-/merge_requests/new?merge_request[title]=Fix'
    );
  });

  it.each([
    ['github', 'https://github.com/org/repo', 'https://github.com/org/repo/tree/feature/foo'],
    ['gitlab', 'https://gitlab.com/org/repo.git', 'https://gitlab.com/org/repo/-/tree/feature/foo'],
    ['bitbucket', 'https://bitbucket.org/org/repo/', 'https://bitbucket.org/org/repo/src/feature/foo'],
  ])('links the branches of a %s repository', (repoType, baseUrl, branchUrl) => {
    render(
      <PullRequestBanner prURL="https://example.com/pr" isNewPr repoType={repoType} branchInfo={branchInfo(baseUrl)} />
    );

    expect(screen.getByRole('link', { name: /feature\/foo/ })).toHaveAttribute('href', branchUrl);
    expect(screen.getByText('main')).toBeInTheDocument();
  });

  it('hides the branch row and names no provider without a repository type', () => {
    render(
      <PullRequestBanner
        prURL="https://example.com/pr"
        isNewPr
        branchInfo={branchInfo('https://github.com/org/repo')}
      />
    );

    expect(screen.getByText('A new resource has been created in a branch in repository.')).toBeInTheDocument();
    expect(screen.queryByText('feature/foo')).not.toBeInTheDocument();
  });

  it('describes a deleted resource', () => {
    render(<PullRequestBanner prURL="https://example.com/pr" isNewPr repoType="github" action="delete" />);

    expect(screen.getByText('A resource has been deleted in a branch in GitHub.')).toBeInTheDocument();
  });
});

import { render, screen } from 'test/test-utils';

import { PullRequestButtons } from './PullRequestButtons';

describe('PullRequestButtons', () => {
  it('sanitizes javascript: URLs from server', () => {
    render(
      <PullRequestButtons
        urls={{
          newPullRequestURL: 'javascript:alert(1)',
          compareURL: 'javascript:alert(2)',
          sourceURL: 'javascript:alert(3)',
        }}
      />
    );

    const links = screen.getAllByRole('link');
    for (const link of links) {
      expect(link).not.toHaveAttribute('href', expect.stringContaining('javascript:'));
    }
  });

  it('preserves valid URLs', () => {
    render(
      <PullRequestButtons
        urls={{
          newPullRequestURL: 'https://github.com/org/repo/compare/main...branch',
          compareURL: 'https://github.com/org/repo/compare/main...branch',
          sourceURL: 'https://github.com/org/repo/tree/branch',
        }}
      />
    );

    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveAttribute('href', 'https://github.com/org/repo/tree/branch');
    expect(links[1]).toHaveAttribute('href', 'https://github.com/org/repo/compare/main...branch');
    expect(links[2]).toHaveAttribute('href', 'https://github.com/org/repo/compare/main...branch');
  });

  it('renders the open-pull-request link when a PR URL is present', () => {
    render(<PullRequestButtons urls={{ newPullRequestURL: 'https://github.com/org/repo/compare/main...branch' }} />);

    expect(screen.getByRole('link', { name: /open pull request/i })).toHaveAttribute(
      'href',
      'https://github.com/org/repo/compare/main...branch'
    );
  });

  it('shows only the open-pull-request link for a sync (migrate) job', () => {
    render(
      <PullRequestButtons
        jobType="sync"
        urls={{
          newPullRequestURL: 'https://github.com/org/repo/compare/main...branch',
          compareURL: 'https://github.com/org/repo/compare/main...branch',
          sourceURL: 'https://github.com/org/repo/tree/branch',
        }}
      />
    );

    expect(screen.getByRole('link', { name: /open pull request/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /view branch/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /compare branch/i })).not.toBeInTheDocument();
  });
});

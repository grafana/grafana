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

  it('returns null for sync job type', () => {
    const { container } = render(
      <PullRequestButtons jobType="sync" urls={{ newPullRequestURL: 'https://example.com' }} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});

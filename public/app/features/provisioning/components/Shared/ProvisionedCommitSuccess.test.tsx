import { render, screen } from 'test/test-utils';

import { ProvisionedCommitSuccess } from './ProvisionedCommitSuccess';

const repoUrl = 'https://github.com/your-org/your-repo';

describe('ProvisionedCommitSuccess', () => {
  it('reports a direct commit as already live for the organization', () => {
    render(
      <ProvisionedCommitSuccess
        outcome={{ action: 'update', configuredBranch: 'main', repoType: 'github', repoUrl: repoUrl }}
      />
    );

    expect(screen.getByText('Committed to main.')).toBeInTheDocument();
    expect(screen.getByText(/already live in Grafana for everyone in your organization/i)).toBeInTheDocument();
    // A direct commit has no branch to compare, so neither branch row is offered.
    expect(screen.queryByText('Your branch')).not.toBeInTheDocument();
  });

  it('reports a branch commit as invisible to others, and links both branches', () => {
    render(
      <ProvisionedCommitSuccess
        outcome={{
          action: 'create',
          branch: 'grafana-sync/create-playlist/abc123',
          configuredBranch: 'main',
          repoType: 'github',
          repoUrl: repoUrl,
          message: 'create: playlist "StockholmWallTV2"',
        }}
      />
    );

    expect(screen.getByText(/created in a branch in GitHub/i)).toBeInTheDocument();
    expect(screen.getByText(/until this branch is merged/i)).toBeInTheDocument();
    expect(screen.getByText('grafana-sync/create-playlist/abc123')).toBeInTheDocument();
    expect(screen.getByText('main')).toBeInTheDocument();
    expect(screen.getByText('create: playlist "StockholmWallTV2"')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: /open grafana-sync\/create-playlist\/abc123/i })).toHaveAttribute(
      'href',
      `${repoUrl}/tree/grafana-sync/create-playlist/abc123`
    );
    expect(screen.getByRole('link', { name: /open main/i })).toHaveAttribute('href', `${repoUrl}/tree/main`);
  });

  it('links the commit message to the committed file', () => {
    render(
      <ProvisionedCommitSuccess
        outcome={{
          action: 'create',
          configuredBranch: 'main',
          repoType: 'github',
          message: 'create: playlist',
          sourceUrl: `${repoUrl}/blob/main/stockholmwalltv2.json`,
        }}
      />
    );

    expect(screen.getByText('create: playlist')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open the committed file/i })).toHaveAttribute(
      'href',
      `${repoUrl}/blob/main/stockholmwalltv2.json`
    );
  });

  it('reports no commit row where the write reported only a content hash', () => {
    render(<ProvisionedCommitSuccess outcome={{ action: 'create', configuredBranch: 'main', repoType: 'git' }} />);

    expect(screen.queryByText(/last commit/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it.each([
    ['update', /updated in a branch/i],
    ['delete', /deleted in a branch/i],
    ['move', /moved in a branch/i],
  ] as const)('names the %s action in the branch headline', (action, expected) => {
    render(
      <ProvisionedCommitSuccess
        outcome={{ action: action, branch: 'feature', configuredBranch: 'main', repoType: 'github' }}
      />
    );

    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('tells the user to open the pull request themselves on a plain git remote', () => {
    render(
      <ProvisionedCommitSuccess
        outcome={{ action: 'create', branch: 'feature', configuredBranch: 'main', repoType: 'git' }}
      />
    );

    expect(screen.getByText(/create a pull or merge request from the branch you saved to/i)).toBeInTheDocument();
  });

  it('does not ask for a manual pull request where the provider opens one', () => {
    render(
      <ProvisionedCommitSuccess
        outcome={{ action: 'create', branch: 'feature', configuredBranch: 'main', repoType: 'github' }}
      />
    );

    expect(screen.queryByText(/create a pull or merge request/i)).not.toBeInTheDocument();
  });

  it('omits the branch links when the repository has no browsable branch URLs', () => {
    render(
      <ProvisionedCommitSuccess
        outcome={{ action: 'create', branch: 'feature', configuredBranch: 'main', repoType: 'local' }}
      />
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('feature')).toBeInTheDocument();
  });
});

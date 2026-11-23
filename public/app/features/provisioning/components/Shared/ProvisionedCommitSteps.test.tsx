import { render, screen } from 'test/test-utils';

import { ProvisionedCommitSteps } from './ProvisionedCommitSteps';
import { type ProvisionedCommitOutcome } from './provisionedCommitOutcome';

const mockNavigate = jest.fn();
jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useNavigate: () => mockNavigate,
}));

const onDismiss = jest.fn();

const direct: ProvisionedCommitOutcome = {
  action: 'update',
  configuredBranch: 'main',
  repoType: 'github',
  repoUrl: 'https://github.com/your-org/your-repo',
};

const onBranch: ProvisionedCommitOutcome = { ...direct, branch: 'grafana-sync/update/abc123' };

describe('ProvisionedCommitSteps', () => {
  beforeEach(() => jest.clearAllMocks());

  it('builds the resource and list steps from the kind registry, naming the kind', () => {
    render(<ProvisionedCommitSteps kindKey="playlist" outcome={direct} resourceName="wall-tv" onDismiss={onDismiss} />);

    expect(screen.getByRole('button', { name: 'View playlist' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to all playlists' })).toBeInTheDocument();
  });

  it.each([
    ['playlist', '/playlists/edit/wall-tv', '/playlists'],
    ['dashboard', '/d/wall-tv', '/dashboards'],
  ] as const)('routes the %s steps to the pages its entry declares', async (kindKey, resourceRoute, listRoute) => {
    const { user } = render(
      <ProvisionedCommitSteps kindKey={kindKey} outcome={direct} resourceName="wall-tv" onDismiss={onDismiss} />
    );

    await user.click(screen.getByRole('button', { name: /^view/i }));
    expect(mockNavigate).toHaveBeenCalledWith(resourceRoute);

    await user.click(screen.getByRole('button', { name: /^back to all/i }));
    expect(mockNavigate).toHaveBeenCalledWith(listRoute);
    // The drawer outlives the commit, so a step onto a route it is already on must still close it.
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });

  it('offers no way to view a branch commit for a kind with no preview page', () => {
    render(
      <ProvisionedCommitSteps kindKey="playlist" outcome={onBranch} resourceName="wall-tv" onDismiss={onDismiss} />
    );

    expect(screen.queryByRole('button', { name: /^view/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open repository' })).toBeInTheDocument();
  });

  it('views a branch commit through the preview page a kind supplies', () => {
    render(
      <ProvisionedCommitSteps
        kindKey="dashboard"
        outcome={onBranch}
        resourceName="wall-tv"
        branchViewUrl="/dashboard/provisioning/repo/preview/wall-tv.json?ref=feature"
        onDismiss={onDismiss}
      />
    );

    expect(screen.getByRole('button', { name: 'View dashboard' })).toBeInTheDocument();
  });

  it('offers no resource step for a delete, which leaves nothing to look at', () => {
    render(
      <ProvisionedCommitSteps
        kindKey="playlist"
        outcome={{ ...direct, action: 'delete' }}
        resourceName="wall-tv"
        onDismiss={onDismiss}
      />
    );

    expect(screen.queryByRole('button', { name: /^view/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to all playlists' })).toBeInTheDocument();
  });

  it('offers no resource step for a selection, which has no single page to go to', () => {
    render(<ProvisionedCommitSteps kindKey="playlist" outcome={{ ...direct, count: 4 }} onDismiss={onDismiss} />);

    expect(screen.queryByRole('button', { name: /^view/i })).not.toBeInTheDocument();
  });

  it('falls back to closing when no kind is named and the commit opened nothing', async () => {
    const { user } = render(<ProvisionedCommitSteps outcome={{ ...direct, count: 4 }} onDismiss={onDismiss} />);

    expect(screen.queryByRole('button', { name: /^back to all/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('prefers the pull request over the repository as the way out to the provider', () => {
    render(
      <ProvisionedCommitSteps
        kindKey="playlist"
        outcome={{ ...onBranch, prUrl: 'https://example.com/pr/1' }}
        onDismiss={onDismiss}
      />
    );

    expect(screen.getByRole('link', { name: 'Open pull request' })).toHaveAttribute('href', 'https://example.com/pr/1');
    expect(screen.queryByRole('link', { name: 'Open repository' })).not.toBeInTheDocument();
  });
});

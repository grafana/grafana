import { render, screen } from 'test/test-utils';

import { ProvisionedCommitSteps } from './ProvisionedCommitSteps';
import { type ProvisionedCommitOutcome } from './provisionedCommitOutcome';

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

  it('offers closing after a direct commit', async () => {
    const { user } = render(<ProvisionedCommitSteps outcome={direct} onDismiss={onDismiss} />);

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('offers the repository after a branch commit without a pull request', () => {
    render(<ProvisionedCommitSteps outcome={onBranch} onDismiss={onDismiss} />);

    expect(screen.getByRole('link', { name: 'Open repository' })).toHaveAttribute('href', direct.repoUrl);
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
  });

  it('prefers the pull request over the repository', () => {
    render(
      <ProvisionedCommitSteps outcome={{ ...onBranch, prUrl: 'https://example.com/pr/1' }} onDismiss={onDismiss} />
    );

    expect(screen.getByRole('link', { name: 'Open pull request' })).toHaveAttribute('href', 'https://example.com/pr/1');
    expect(screen.queryByRole('link', { name: 'Open repository' })).not.toBeInTheDocument();
  });
});

import { render, screen } from 'test/test-utils';

import { type DashboardCommitOutcome, ProvisionedDashboardOutcome } from './ProvisionedDashboardOutcome';

const mockNavigate = jest.fn();
jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useNavigate: () => mockNavigate,
}));

const base: DashboardCommitOutcome = {
  action: 'update',
  message: 'update: dashboard "Fleet overview"',
  configuredBranch: 'main',
  repoType: 'github',
  repoUrl: 'https://github.com/your-org/your-repo',
};

describe('ProvisionedDashboardOutcome', () => {
  beforeEach(() => jest.clearAllMocks());

  it('offers the pull request where the provider opens one', () => {
    render(
      <ProvisionedDashboardOutcome
        outcome={{ ...base, branch: 'dashboard/2026-01-01-abcde', prUrl: 'https://example.com/pr/1' }}
      />
    );

    expect(screen.getByText(/updated in a branch in GitHub/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open pull request/i })).toHaveAttribute(
      'href',
      'https://example.com/pr/1'
    );
  });

  it('falls back to the repository on a plain git remote, which opens none', () => {
    render(
      <ProvisionedDashboardOutcome
        outcome={{ ...base, repoType: 'git', branch: 'dashboard/2026-01-01-abcde', prUrl: undefined }}
      />
    );

    expect(screen.getByRole('link', { name: /open repository/i })).toHaveAttribute('href', base.repoUrl);
    expect(screen.getByText(/create a pull or merge request from the branch you saved to/i)).toBeInTheDocument();
  });

  it('offers no external link for a direct commit, which has no branch to raise a request from', () => {
    render(<ProvisionedDashboardOutcome outcome={{ ...base, viewUrl: '/d/fleet-overview' }} />);

    expect(screen.getByText('Committed to main.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /open (pull request|repository)/i })).not.toBeInTheDocument();
  });

  it('navigates to the dashboard and to the list', async () => {
    const { user } = render(<ProvisionedDashboardOutcome outcome={{ ...base, viewUrl: '/d/fleet-overview' }} />);

    await user.click(screen.getByRole('button', { name: /view dashboard/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/d/fleet-overview');

    await user.click(screen.getByRole('button', { name: /back to all dashboards/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboards');
  });

  it('omits the view step when the commit produced nothing to view', () => {
    render(<ProvisionedDashboardOutcome outcome={base} />);

    expect(screen.queryByRole('button', { name: /view dashboard/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back to all dashboards/i })).toBeInTheDocument();
  });
});

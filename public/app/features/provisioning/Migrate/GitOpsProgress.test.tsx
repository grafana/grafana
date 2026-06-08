import { render, screen } from 'test/test-utils';

import { GitOpsProgress } from './GitOpsProgress';

describe('GitOpsProgress', () => {
  it('shows overall managed progress with the breakdown cards open by default', () => {
    render(
      <GitOpsProgress
        totals={{ instanceTotal: 100, managed: 50, unmanaged: 50, gitSync: 40 }}
        folderCounts={{ managed: 6, total: 8 }}
      />
    );

    // 56 of 108 managed => 52%.
    expect(screen.getByText('Progress to GitOps')).toBeInTheDocument();
    expect(screen.getByText('52%')).toBeInTheDocument();
    expect(screen.getByText('56 of 108 resources managed')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '52');

    // Breakdown cards are visible by default.
    expect(screen.getByText('Dashboards')).toBeInTheDocument();
    expect(screen.getByText('Folders')).toBeInTheDocument();
  });

  it('collapses the per-resource cards when toggled', async () => {
    const { user } = render(
      <GitOpsProgress
        totals={{ instanceTotal: 100, managed: 50, unmanaged: 50, gitSync: 40 }}
        folderCounts={{ managed: 6, total: 8 }}
      />
    );

    await user.click(screen.getByRole('button', { name: /toggle migration details/i }));

    expect(screen.queryByText('Dashboards')).not.toBeInTheDocument();
    expect(screen.queryByText('Folders')).not.toBeInTheDocument();
  });
});

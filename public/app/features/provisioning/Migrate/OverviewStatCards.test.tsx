import { render, screen } from 'test/test-utils';

import { OverviewStatCards } from './OverviewStatCards';

describe('OverviewStatCards', () => {
  it('renders the five cards with computed values', () => {
    render(
      <OverviewStatCards
        totals={{ instanceTotal: 100, managed: 50, unmanaged: 50, gitSync: 40 }}
        folderCounts={{ managed: 6, total: 8 }}
      />
    );

    // Total dashboards.
    expect(screen.getByText('Dashboards')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();

    // Managed + unmanaged both read 50% / "50 of 100 dashboards".
    expect(screen.getByText('Managed dashboards')).toBeInTheDocument();
    expect(screen.getByText('Unmanaged dashboards')).toBeInTheDocument();
    expect(screen.getAllByText('50%')).toHaveLength(2);
    expect(screen.getAllByText('50 of 100 dashboards')).toHaveLength(2);

    // Progress to GitOps.
    expect(screen.getByText('Progress to GitOps')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(screen.getByText('40 via Git Sync')).toBeInTheDocument();

    // Folders managed gauge.
    expect(screen.getByText('Folders managed')).toBeInTheDocument();
    expect(screen.getByText('6 / 8')).toBeInTheDocument();
    expect(screen.getByText('75% complete')).toBeInTheDocument();
  });

  it('prompts to start when nothing is on Git Sync yet', () => {
    render(
      <OverviewStatCards
        totals={{ instanceTotal: 10, managed: 0, unmanaged: 10, gitSync: 0 }}
        folderCounts={{ managed: 0, total: 2 }}
      />
    );

    expect(screen.getByText('Progress to GitOps')).toBeInTheDocument();
    expect(screen.getByText('Start your migration')).toBeInTheDocument();
  });
});

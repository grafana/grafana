import { render, screen } from '@testing-library/react';

import { useGetResourceStatsQuery } from 'app/api/clients/provisioning/v0alpha1';

import { StatsTabContent } from './StatsTabContent';

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  useGetResourceStatsQuery: jest.fn(),
}));

// ConnectRepositoryButton requires Router + Redux + frontend settings; stub it
// so this test stays focused on the StatsTabContent rendering logic.
jest.mock('../Shared/ConnectRepositoryButton', () => ({
  ConnectRepositoryButton: () => <button>Connect a repository</button>,
}));

const mockUseGetResourceStatsQuery = useGetResourceStatsQuery as jest.MockedFunction<typeof useGetResourceStatsQuery>;

function mockQuery(value: Partial<ReturnType<typeof useGetResourceStatsQuery>>) {
  mockUseGetResourceStatsQuery.mockReturnValue({
    refetch: jest.fn(),
    isLoading: false,
    isError: false,
    isFetching: false,
    isSuccess: true,
    isUninitialized: false,
    status: 'fulfilled',
    ...value,
  } as ReturnType<typeof useGetResourceStatsQuery>);
}

describe('StatsTabContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders a loading indicator while fetching', () => {
    mockQuery({ isLoading: true, isSuccess: false, status: 'pending' });
    render(<StatsTabContent />);
    expect(screen.getByText(/loading stats/i)).toBeInTheDocument();
  });

  it('renders an error alert on failure', () => {
    mockQuery({ isError: true, isSuccess: false, status: 'rejected', error: { status: 500 } });
    render(<StatsTabContent />);
    expect(screen.getByText(/failed to load provisioning stats/i)).toBeInTheDocument();
  });

  it('renders the empty state when no resources exist', () => {
    mockQuery({ data: { instance: [], unmanaged: [], managed: [] } });
    render(<StatsTabContent />);
    expect(screen.getByText(/no provisioned resources yet/i)).toBeInTheDocument();
  });

  it('shows the provisioned-as-code headline and the Git Sync banner', () => {
    mockQuery({
      data: {
        instance: [
          { group: 'folder.grafana.app', resource: 'folders', count: 4 },
          { group: 'dashboard.grafana.app', resource: 'dashboards', count: 16 },
        ],
        unmanaged: [],
        managed: [
          {
            kind: 'repo',
            id: 'r1',
            stats: [
              { group: 'folder.grafana.app', resource: 'folders', count: 1 },
              { group: 'dashboard.grafana.app', resource: 'dashboards', count: 4 },
            ],
          },
        ],
      },
    });

    render(<StatsTabContent />);

    // 5 of 20 = 25% of resources are provisioned as code.
    expect(screen.getByText(/25% of resources are provisioned as code/i)).toBeInTheDocument();
    // The single Git Sync banner replaces the previous green card + unmanaged
    // alert pair: it leads with the coverage count and ends with the CTA.
    expect(screen.getByText(/5 of 20 folders and dashboards are managed by Git Sync/i)).toBeInTheDocument();
    expect(screen.getByText(/git sync is the simplest way/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /connect a repository/i })).toBeInTheDocument();
  });

  it('hides the Git Sync banner when there are no folders or dashboards', () => {
    mockQuery({
      data: {
        instance: [{ group: 'datasource.grafana.app', resource: 'datasources', count: 5 }],
        unmanaged: [],
        managed: [],
      },
    });

    render(<StatsTabContent />);

    // Without any folders or dashboards the encourage-to-use-Git-Sync banner
    // shouldn't show — there's nothing to connect a repository for yet.
    expect(screen.queryByText(/folders and dashboards are managed by Git Sync/i)).not.toBeInTheDocument();
  });

  it('lists Other providers with their manager identities', () => {
    mockQuery({
      data: {
        instance: [{ group: 'dashboard.grafana.app', resource: 'dashboards', count: 50 }],
        unmanaged: [],
        managed: [
          {
            kind: 'terraform',
            id: 'tf-1',
            stats: [{ group: 'dashboard.grafana.app', resource: 'dashboards', count: 12 }],
          },
          {
            kind: 'plugin',
            id: 'cool-plugin',
            stats: [{ group: 'dashboard.grafana.app', resource: 'dashboards', count: 4 }],
          },
        ],
      },
    });

    render(<StatsTabContent />);

    expect(screen.getByText('Other providers')).toBeInTheDocument();
    // Specific manager identities are surfaced.
    expect(screen.getByText('tf-1')).toBeInTheDocument();
    expect(screen.getByText('cool-plugin')).toBeInTheDocument();
  });

  it('buckets managers with no kind under Unknown rather than Git Sync', () => {
    mockQuery({
      data: {
        instance: [{ group: 'dashboard.grafana.app', resource: 'dashboards', count: 5 }],
        unmanaged: [],
        managed: [
          {
            id: 'orphan',
            stats: [{ group: 'dashboard.grafana.app', resource: 'dashboards', count: 5 }],
          },
        ],
      },
    });

    render(<StatsTabContent />);

    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('derives the Unmanaged summary from instance - managed so the totals balance', () => {
    mockQuery({
      data: {
        instance: [
          { group: 'folder.grafana.app', resource: 'folders', count: 10 },
          { group: 'dashboard.grafana.app', resource: 'dashboards', count: 30 },
        ],
        // unmanaged comes back empty: backend trusts that managed covers everything.
        unmanaged: [],
        managed: [
          {
            kind: 'repo',
            id: 'r1',
            stats: [
              { group: 'folder.grafana.app', resource: 'folders', count: 4 },
              { group: 'dashboard.grafana.app', resource: 'dashboards', count: 12 },
            ],
          },
          {
            kind: 'terraform',
            id: 'tf-1',
            stats: [{ group: 'dashboard.grafana.app', resource: 'dashboards', count: 6 }],
          },
        ],
      },
    });

    render(<StatsTabContent />);

    // Total = 40, Git Sync = 16, Other = 6, Unmanaged = 18.
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getAllByText(/16 of 40/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/6 of 40/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/18 of 40/i).length).toBeGreaterThan(0);
    // The donut center reports the combined managed share (22/40 = 55%).
    expect(screen.getAllByText('55%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('45%').length).toBeGreaterThan(0);
  });

  it('renders the Resource types section with supported-by chips per row', () => {
    mockQuery({
      data: {
        instance: [
          { group: 'datasource.grafana.app', resource: 'datasources', count: 5 },
          { group: 'alerting.grafana.app', resource: 'alertrules', count: 7 },
        ],
        unmanaged: [],
        managed: [],
      },
    });

    render(<StatsTabContent />);

    expect(screen.getByText('Resource types')).toBeInTheDocument();
    // Both datasources and alert rules should list Terraform and Classic file
    // provisioning as supporting providers via chips in the row.
    expect(screen.getAllByText('Terraform').length).toBeGreaterThan(1);
    expect(screen.getAllByText('File provisioning (classic)').length).toBeGreaterThan(0);
  });

  it('lists every resource type once in the Resource types section', () => {
    mockQuery({
      data: {
        instance: [
          { group: 'alerting.grafana.app', resource: 'alertrules', count: 10 },
          { group: 'dashboard.grafana.app', resource: 'dashboards', count: 4 },
        ],
        unmanaged: [],
        managed: [
          {
            kind: 'terraform',
            id: 'tf-a',
            stats: [{ group: 'alerting.grafana.app', resource: 'alertrules', count: 4 }],
          },
          {
            kind: 'terraform',
            id: 'tf-b',
            stats: [{ group: 'alerting.grafana.app', resource: 'alertrules', count: 6 }],
          },
        ],
      },
    });

    render(<StatsTabContent />);

    expect(screen.getByText('Resource types')).toBeInTheDocument();
    // Each resource type should appear exactly once in the table even when
    // multiple managers of the same kind report it.
    expect(screen.getAllByText('alertrules')).toHaveLength(1);
    // Folders/dashboards are now part of this table too.
    expect(screen.getAllByText('Dashboards').length).toBeGreaterThan(0);
  });
});

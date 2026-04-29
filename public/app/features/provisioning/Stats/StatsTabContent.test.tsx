import { render, screen } from '@testing-library/react';

import { useGetResourceStatsQuery } from 'app/api/clients/provisioning/v0alpha1';

import { StatsTabContent } from './StatsTabContent';

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  useGetResourceStatsQuery: jest.fn(),
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

  it('renders the migration readiness section with folder/dashboard breakdowns', () => {
    mockQuery({
      data: {
        instance: [
          { group: 'folder.grafana.app', resource: 'folders', count: 10 },
          { group: 'dashboard.grafana.app', resource: 'dashboards', count: 25 },
        ],
        unmanaged: [{ group: 'dashboard.grafana.app', resource: 'dashboards', count: 5 }],
        managed: [
          {
            kind: 'repo',
            id: 'my-github-repo',
            stats: [
              { group: 'folder.grafana.app', resource: 'folders', count: 7 },
              { group: 'dashboard.grafana.app', resource: 'dashboards', count: 20 },
            ],
          },
        ],
      },
    });

    render(<StatsTabContent />);

    expect(screen.getByText('Folders and dashboards')).toBeInTheDocument();
    expect(screen.getByText('By repository')).toBeInTheDocument();
    expect(screen.getByText('my-github-repo')).toBeInTheDocument();
    // Folders breakdown card should expose the 7-managed and the 3-unmanaged figures.
    expect(screen.getAllByText('7').length).toBeGreaterThan(0);
    expect(screen.getAllByText('20').length).toBeGreaterThan(0);
  });

  it('always shows Folders and Dashboards rows in migration readiness, even at zero', () => {
    mockQuery({
      data: {
        // Backend only reports a single dashboard; folders are absent entirely.
        instance: [{ group: 'dashboard.grafana.app', resource: 'dashboards', count: 1 }],
        unmanaged: [],
        managed: [],
      },
    });

    render(<StatsTabContent />);

    // Migration readiness should still surface the Folders row even though
    // the API didn't return any.
    expect(screen.getAllByText('Folders').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Dashboards').length).toBeGreaterThan(0);
    // The 1 dashboard the user knows they have is reflected in the totals.
    expect(screen.getAllByText(/1 total/i).length).toBeGreaterThan(0);
  });

  it('shows unmanaged counts for Git-Sync-supported types', () => {
    mockQuery({
      data: {
        instance: [
          { group: 'folder.grafana.app', resource: 'folders', count: 10 },
          { group: 'dashboard.grafana.app', resource: 'dashboards', count: 20 },
        ],
        unmanaged: [],
        managed: [],
      },
    });

    render(<StatsTabContent />);

    // 30 unmanaged folders + dashboards triggers the unmanaged callout.
    expect(screen.getAllByText(/aren’t managed yet|isn’t managed by any provider/i).length).toBeGreaterThan(0);
    // The Folders / Dashboards breakdown rows include their totals.
    expect(screen.getAllByText('Folders').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Dashboards').length).toBeGreaterThan(0);
  });

  it('groups other manager kinds into the Other providers section and lists identities', () => {
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
    expect(screen.getByText('Terraform')).toBeInTheDocument();
    expect(screen.getByText('Plugin')).toBeInTheDocument();
    // Specific manager identities are surfaced.
    expect(screen.getByText('tf-1')).toBeInTheDocument();
    expect(screen.getByText('cool-plugin')).toBeInTheDocument();
  });

  it('lists per-manager-kind chips on each Folders/Dashboards card', () => {
    mockQuery({
      data: {
        instance: [{ group: 'dashboard.grafana.app', resource: 'dashboards', count: 10 }],
        unmanaged: [],
        managed: [
          {
            kind: 'terraform',
            id: 'tf-prod',
            stats: [{ group: 'dashboard.grafana.app', resource: 'dashboards', count: 3 }],
          },
          {
            kind: 'plugin',
            id: 'cool-plugin',
            stats: [{ group: 'dashboard.grafana.app', resource: 'dashboards', count: 2 }],
          },
        ],
      },
    });

    render(<StatsTabContent />);

    // The per-resource breakdown card for Dashboards should show "Managed by:"
    // chips for each non-Git-Sync manager kind with its count.
    expect(screen.getByText(/managed by:/i)).toBeInTheDocument();
    expect(screen.getByText(/Terraform · 3/)).toBeInTheDocument();
    expect(screen.getByText(/Plugin · 2/)).toBeInTheDocument();
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
    // Without any repo-kind manager there should be no "By repository" subsection.
    expect(screen.queryByText('By repository')).not.toBeInTheDocument();
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

    // Total = 40, Git Sync = 16 (4 folders + 12 dashboards), Other = 6
    // (terraform dashboards), Unmanaged = 18.
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getAllByText(/16 of 40/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/6 of 40/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/18 of 40/i).length).toBeGreaterThan(0);
    // The donut center reports the combined managed share (22/40 = 55%).
    expect(screen.getAllByText('55%').length).toBeGreaterThan(0);
    // 18/40 = 45% appears as the Unmanaged card big number.
    expect(screen.getAllByText('45%').length).toBeGreaterThan(0);
  });

  it('lists every resource type once in the All resources section', () => {
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

    expect(screen.getByText('All resource types')).toBeInTheDocument();
    // Each resource type should appear exactly once in the table even when
    // multiple managers of the same kind report it.
    expect(screen.getAllByText('alertrules')).toHaveLength(1);
  });
});

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

    expect(screen.getByText('Git Sync migration readiness')).toBeInTheDocument();
    expect(screen.getByText('By repository')).toBeInTheDocument();
    expect(screen.getByText('my-github-repo')).toBeInTheDocument();
    // Folders breakdown card should expose the 7-managed and the 3-unmanaged figures.
    expect(screen.getAllByText('7').length).toBeGreaterThan(0);
    expect(screen.getAllByText('20').length).toBeGreaterThan(0);
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

    // 30 unmanaged across folders + dashboards is highlighted as eligible.
    expect(screen.getByText(/eligible to migrate/i)).toBeInTheDocument();
    // The Folders / Dashboards breakdown rows include their totals.
    expect(screen.getAllByText('Folders').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Dashboards').length).toBeGreaterThan(0);
  });

  it('groups other manager kinds into the Other providers section', () => {
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

    // Total = 40, Managed = 22 (4 + 12 + 6), Unmanaged = 40 - 22 = 18.
    // toLocaleString() in tests will not insert separators for these values.
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText('22')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
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

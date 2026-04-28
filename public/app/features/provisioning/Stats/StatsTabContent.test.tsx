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

  it('renders Git Sync as the primary section with folder/dashboard counts', () => {
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

    expect(screen.getByText('Git Sync')).toBeInTheDocument();
    expect(screen.getByText('my-github-repo')).toBeInTheDocument();
    // Folders count (7) and dashboards count (20) for the manager.
    expect(screen.getAllByText('7').length).toBeGreaterThan(0);
    expect(screen.getAllByText('20').length).toBeGreaterThan(0);
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
    // Git Sync should still render but with the empty state.
    expect(screen.getByText(/no resources are managed by git sync/i)).toBeInTheDocument();
  });
});

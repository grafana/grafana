import { render, screen } from 'test/test-utils';

import { type ResourceStats, useGetResourceStatsQuery } from 'app/api/clients/provisioning/v0alpha1';

import { Migrate } from './Migrate';

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  ...jest.requireActual('app/api/clients/provisioning/v0alpha1'),
  useGetResourceStatsQuery: jest.fn(),
}));

const mockUseGetResourceStatsQuery = jest.mocked(useGetResourceStatsQuery);

// 100 dashboards total, 40 managed by Git Sync, 10 by Terraform => 50 managed,
// 50 unmanaged. 8 folders total, 6 managed (4 git sync + 2 terraform).
const stats: ResourceStats = {
  instance: [
    { group: 'dashboard.grafana.app', resource: 'dashboards', count: 100 },
    { group: 'folder.grafana.app', resource: 'folders', count: 8 },
  ],
  managed: [
    {
      kind: 'repo',
      stats: [
        { group: 'dashboard.grafana.app', resource: 'dashboards', count: 40 },
        { group: 'folder.grafana.app', resource: 'folders', count: 4 },
      ],
    },
    {
      kind: 'terraform',
      stats: [
        { group: 'dashboard.grafana.app', resource: 'dashboards', count: 10 },
        { group: 'folder.grafana.app', resource: 'folders', count: 2 },
      ],
    },
  ],
};

function mockQuery(overrides: Partial<ReturnType<typeof useGetResourceStatsQuery>>) {
  mockUseGetResourceStatsQuery.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    error: undefined,
    refetch: jest.fn(),
    ...overrides,
  } as ReturnType<typeof useGetResourceStatsQuery>);
}

describe('Migrate', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders a loading spinner while stats are loading', () => {
    mockQuery({ isLoading: true });

    render(<Migrate />);

    expect(screen.getByText(/loading stats/i)).toBeInTheDocument();
  });

  it('renders an error alert when the stats query fails', () => {
    mockQuery({ isError: true, error: { message: 'boom' } });

    render(<Migrate />);

    expect(screen.getByText(/failed to load provisioning stats/i)).toBeInTheDocument();
  });

  it('renders an empty state when there are no dashboards', () => {
    mockQuery({ data: { instance: [], managed: [] } });

    render(<Migrate />);

    expect(screen.getByRole('heading', { name: /migrate to gitops/i })).toBeInTheDocument();
    expect(screen.getByText(/no provisioned resources yet/i)).toBeInTheDocument();
  });

  describe('with stats', () => {
    beforeEach(() => {
      mockQuery({ data: stats });
    });

    it('renders the header with an experimental badge', () => {
      render(<Migrate />);

      expect(screen.getByRole('heading', { name: /migrate to gitops/i })).toBeInTheDocument();
      expect(screen.getByText(/^experimental$/i)).toBeInTheDocument();
    });

    it('renders the five overview cards with the expected values', () => {
      render(<Migrate />);

      // Total dashboards card.
      expect(screen.getByText('Dashboards')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();

      // Managed dashboards: 50 of 100 => 50%.
      expect(screen.getByText('Managed dashboards')).toBeInTheDocument();

      // Unmanaged dashboards: 50 of 100 => 50%.
      expect(screen.getByText('Unmanaged dashboards')).toBeInTheDocument();

      // Both managed and unmanaged report "50 of 100 dashboards".
      expect(screen.getAllByText('50 of 100 dashboards')).toHaveLength(2);

      // Progress to GitOps: 40 of 100 => 40%, "40 via Git Sync".
      expect(screen.getByText('Progress to GitOps')).toBeInTheDocument();
      expect(screen.getByText('40%')).toBeInTheDocument();
      expect(screen.getByText('40 via Git Sync')).toBeInTheDocument();

      // Two cards show 50% (managed + unmanaged).
      expect(screen.getAllByText('50%')).toHaveLength(2);
    });

    it('renders the folders managed gauge with managed/total and percentage', () => {
      render(<Migrate />);

      expect(screen.getByText('Folders managed')).toBeInTheDocument();
      // 6 of 8 folders managed (4 git sync + 2 terraform).
      expect(screen.getByText('6 / 8')).toBeInTheDocument();
      // 6 / 8 => 75%.
      expect(screen.getByText('75% complete')).toBeInTheDocument();
    });
  });
});

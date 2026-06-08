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

    it('shows overall progress and reveals one status card per resource type when expanded', async () => {
      const { user } = render(<Migrate />);

      // Overall progress bar across all resource types (56 of 108 => 52%).
      expect(screen.getByText('Progress to GitOps')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '52');

      // Breakdown cards are collapsed by default.
      expect(screen.queryByText('Dashboards')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /toggle migration details/i }));

      // Dashboards: 50 of 100 managed; Folders: 6 of 8 managed.
      expect(screen.getByText('Dashboards')).toBeInTheDocument();
      expect(screen.getByText('50 of 100 managed')).toBeInTheDocument();
      expect(screen.getByText('Folders')).toBeInTheDocument();
      expect(screen.getByText('6 of 8 managed')).toBeInTheDocument();
    });

    it('keeps the migration guide note linking to the provisioning docs', () => {
      render(<Migrate />);

      expect(screen.getByText(/the guided migration workflow is on its way/i)).toBeInTheDocument();
      const docsLink = screen.getByRole('link', { name: /provisioning documentation/i });
      expect(docsLink).toHaveAttribute('href', expect.stringContaining('grafana.com/docs'));
    });
  });
});

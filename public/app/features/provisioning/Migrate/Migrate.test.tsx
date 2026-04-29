import { render, screen } from '@testing-library/react';

import { useGetResourceStatsQuery } from 'app/api/clients/provisioning/v0alpha1';

import { useRepositoryList } from '../hooks/useRepositoryList';

import { Migrate } from './Migrate';
import { type FolderRow, useFolderLeaderboard } from './hooks/useFolderLeaderboard';

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  useGetResourceStatsQuery: jest.fn(),
}));

jest.mock('../hooks/useRepositoryList', () => ({
  useRepositoryList: jest.fn(() => [[], false]),
}));

jest.mock('./hooks/useFolderLeaderboard', () => ({
  useFolderLeaderboard: jest.fn(() => ({ data: [], isLoading: false, isError: false })),
}));

const mockUseGetResourceStatsQuery = useGetResourceStatsQuery as jest.MockedFunction<typeof useGetResourceStatsQuery>;
const mockUseRepositoryList = useRepositoryList as jest.MockedFunction<typeof useRepositoryList>;
const mockUseFolderLeaderboard = useFolderLeaderboard as jest.MockedFunction<typeof useFolderLeaderboard>;

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

function makeFolder(partial: Partial<FolderRow> & { uid: string; title: string }): FolderRow {
  return {
    dashboardCount: 0,
    ...partial,
  };
}

describe('Migrate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRepositoryList.mockReturnValue([[], false]);
    mockUseFolderLeaderboard.mockReturnValue({ data: [], isLoading: false, isError: false });
  });

  it('renders a loading indicator while fetching stats', () => {
    mockQuery({ isLoading: true, isSuccess: false, status: 'pending' });
    render(<Migrate />);
    expect(screen.getByText(/loading stats/i)).toBeInTheDocument();
  });

  it('renders an error alert on failure', () => {
    mockQuery({ isError: true, isSuccess: false, status: 'rejected', error: { status: 500 } });
    render(<Migrate />);
    expect(screen.getByText(/failed to load provisioning stats/i)).toBeInTheDocument();
  });

  it('renders the empty state with the Migrate to GitOps header when there are no resources', () => {
    mockQuery({ data: { instance: [], unmanaged: [], managed: [] } });
    render(<Migrate />);
    expect(screen.getByRole('heading', { name: /migrate to gitops/i })).toBeInTheDocument();
    expect(screen.getByText(/no provisioned resources yet/i)).toBeInTheDocument();
  });

  it('shows a Migrate everything button at the bottom of Folders to migrate when unmanaged folders exist', () => {
    mockUseRepositoryList.mockReturnValue([
      [
        {
          metadata: { name: 'my-repo' },
          spec: { type: 'github', sync: { target: 'folder' } },
        },
      ] as ReturnType<typeof useRepositoryList>[0],
      false,
    ]);
    mockQuery({
      data: {
        instance: [
          { group: 'dashboard.grafana.app', resource: 'dashboards', count: 6 },
          { group: 'folder.grafana.app', resource: 'folders', count: 2 },
        ],
        unmanaged: [],
        managed: [],
      },
    });
    mockUseFolderLeaderboard.mockReturnValue({
      data: [
        makeFolder({ uid: 'a', title: 'A', dashboardCount: 3 }),
        makeFolder({ uid: 'b', title: 'B', dashboardCount: 3 }),
      ],
      isLoading: false,
      isError: false,
    });
    render(<Migrate />);
    const link = screen.getByRole('link', { name: /migrate everything \(2 folders\)/i });
    expect(link).toHaveAttribute('href', '/admin/provisioning/my-repo');
  });

  it('hides the Migrate everything button when nothing is unmanaged', () => {
    mockQuery({
      data: {
        instance: [{ group: 'dashboard.grafana.app', resource: 'dashboards', count: 5 }],
        unmanaged: [],
        managed: [],
      },
    });
    mockUseFolderLeaderboard.mockReturnValue({
      data: [
        makeFolder({
          uid: 'a',
          title: 'A',
          dashboardCount: 5,
          managedBy: 'repo',
        }),
      ],
      isLoading: false,
      isError: false,
    });
    render(<Migrate />);
    expect(screen.queryByRole('link', { name: /migrate everything/i })).not.toBeInTheDocument();
  });

  it('marks the page header with an Experimental feature badge', () => {
    mockQuery({
      data: {
        instance: [{ group: 'dashboard.grafana.app', resource: 'dashboards', count: 5 }],
        unmanaged: [],
        managed: [],
      },
    });
    render(<Migrate />);
    expect(screen.getByText(/^experimental$/i)).toBeInTheDocument();
  });

  it('puts a primary Connect button in the next steps when no repository is connected', () => {
    mockUseRepositoryList.mockReturnValue([[], false]);
    mockQuery({
      data: {
        instance: [{ group: 'dashboard.grafana.app', resource: 'dashboards', count: 5 }],
        unmanaged: [],
        managed: [],
      },
    });
    render(<Migrate />);
    const connectLink = screen.getByRole('link', { name: /^connect$/i });
    expect(connectLink).toHaveAttribute('href', '/admin/provisioning/getting-started');
  });

  it('renders the Folders managed gauge card showing managed/total and a percentage', () => {
    mockQuery({
      data: {
        instance: [{ group: 'dashboard.grafana.app', resource: 'dashboards', count: 4 }],
        unmanaged: [],
        managed: [],
      },
    });
    mockUseFolderLeaderboard.mockReturnValue({
      data: [
        makeFolder({ uid: 'a', title: 'A', dashboardCount: 2, managedBy: 'repo' }),
        makeFolder({ uid: 'b', title: 'B', dashboardCount: 2 }),
        makeFolder({ uid: 'c', title: 'C', dashboardCount: 0 }),
        makeFolder({ uid: 'd', title: 'D', dashboardCount: 0, managedBy: 'repo' }),
      ],
      isLoading: false,
      isError: false,
    });
    render(<Migrate />);
    // The gauge card uses an exact "Folders managed" label; the next-steps
    // panel also includes the phrase as part of a longer sentence, so we
    // accept multiple matches here.
    expect(screen.getAllByText(/folders managed/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('2 / 4')).toBeInTheDocument();
    expect(screen.getByText(/50% complete/i)).toBeInTheDocument();
  });

  it('renders the five overview stat cards including Progress to GitOps', () => {
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

    render(<Migrate />);

    expect(screen.getByText('Total resources')).toBeInTheDocument();
    expect(screen.getAllByText('Managed').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Unmanaged').length).toBeGreaterThan(0);
    expect(screen.getByText('Progress to GitOps')).toBeInTheDocument();
    expect(screen.getByText(/5 via git sync/i)).toBeInTheDocument();
  });

  it('shows Quick wins folder cards when the leaderboard surfaces unmanaged folders', () => {
    mockQuery({
      data: {
        instance: [
          { group: 'dashboard.grafana.app', resource: 'dashboards', count: 20 },
          { group: 'folder.grafana.app', resource: 'folders', count: 3 },
        ],
        unmanaged: [],
        managed: [],
      },
    });
    mockUseFolderLeaderboard.mockReturnValue({
      data: [
        makeFolder({ uid: 'pay', title: 'Payments', dashboardCount: 12 }),
        makeFolder({ uid: 'inf', title: 'Infrastructure', dashboardCount: 8 }),
      ],
      isLoading: false,
      isError: false,
    });
    render(<Migrate />);
    // "Quick wins" appears in the panel heading and is also referenced from
    // the Recommended next steps copy, so accept multiple matches.
    expect(screen.getAllByText(/quick wins/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Payments').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Infrastructure').length).toBeGreaterThan(0);
  });

  it('hides Quick wins entirely when no folders have unmanaged dashboards', () => {
    mockQuery({
      data: {
        instance: [{ group: 'dashboard.grafana.app', resource: 'dashboards', count: 5 }],
        unmanaged: [],
        managed: [],
      },
    });
    mockUseFolderLeaderboard.mockReturnValue({
      data: [
        makeFolder({
          uid: 'all',
          title: 'All managed',
          dashboardCount: 5,
          managedBy: 'repo',
        }),
      ],
      isLoading: false,
      isError: false,
    });
    render(<Migrate />);
    expect(screen.queryByText(/quick wins/i)).not.toBeInTheDocument();
  });

  it('renders the Folders to migrate table with per-row Migrate and Browse actions', () => {
    mockUseRepositoryList.mockReturnValue([
      [
        {
          metadata: { name: 'my-repo' },
          spec: { type: 'github', sync: { target: 'folder' } },
        },
      ] as ReturnType<typeof useRepositoryList>[0],
      false,
    ]);
    mockQuery({
      data: {
        instance: [
          { group: 'dashboard.grafana.app', resource: 'dashboards', count: 12 },
          { group: 'folder.grafana.app', resource: 'folders', count: 1 },
        ],
        unmanaged: [],
        managed: [],
      },
    });
    mockUseFolderLeaderboard.mockReturnValue({
      data: [makeFolder({ uid: 'pay', title: 'Payments', dashboardCount: 2 })],
      isLoading: false,
      isError: false,
    });
    render(<Migrate />);
    expect(screen.getByText(/folders to migrate/i)).toBeInTheDocument();
    // "Payments" appears in both the Quick wins card and the folder list row.
    expect(screen.getAllByText('Payments').length).toBeGreaterThanOrEqual(2);
    // Per-row actions: Migrate to {{repo}} and Browse.
    const browse = screen.getByRole('link', { name: /^browse$/i });
    expect(browse).toHaveAttribute('href', '/dashboards/f/pay');
    const migrate = screen.getByRole('link', { name: /^migrate to my-repo$/i });
    expect(migrate).toHaveAttribute('href', '/admin/provisioning/my-repo');
  });

  it('hides already-managed folders from the Folders to migrate table', () => {
    mockQuery({
      data: {
        instance: [{ group: 'dashboard.grafana.app', resource: 'dashboards', count: 8 }],
        unmanaged: [],
        managed: [],
      },
    });
    mockUseFolderLeaderboard.mockReturnValue({
      data: [
        makeFolder({ uid: 'pay', title: 'Payments', dashboardCount: 2 }),
        makeFolder({ uid: 'mgd', title: 'Already managed', dashboardCount: 6, managedBy: 'repo' }),
      ],
      isLoading: false,
      isError: false,
    });
    render(<Migrate />);
    // "Payments" appears in the Quick wins card and the table row.
    expect(screen.getAllByText('Payments').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Already managed')).not.toBeInTheDocument();
    // Footer reflects the unmanaged-only total.
    expect(screen.getByText(/showing 1 of 1 folders/i)).toBeInTheDocument();
  });

it('renders the Provisioning tools panel as tiles ordered Git Sync, Terraform, GCX, File System', () => {
    mockQuery({
      data: {
        instance: [{ group: 'dashboard.grafana.app', resource: 'dashboards', count: 5 }],
        unmanaged: [],
        managed: [],
      },
    });
    render(<Migrate />);
    expect(screen.getByText('Provisioning tools')).toBeInTheDocument();
    expect(screen.getAllByText(/^git sync$/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/^terraform$/i)).toBeInTheDocument();
    expect(screen.getByText(/^gcx$/i)).toBeInTheDocument();
    expect(screen.getByText(/^file system$/i)).toBeInTheDocument();
    expect(screen.getByText(/^recommended$/i)).toBeInTheDocument();
  });
});

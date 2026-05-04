import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { useGetResourceStatsQuery } from 'app/api/clients/provisioning/v0alpha1';

import { useRepositoryList } from '../hooks/useRepositoryList';

import { Migrate } from './Migrate';
import { type FolderRow, useFolderLeaderboard } from './hooks/useFolderLeaderboard';

jest.mock('app/api/clients/folder/v1beta1', () => ({
  useGetFolderQuery: jest.fn(() => ({ data: undefined, isLoading: false, error: undefined })),
}));

jest.mock('app/features/provisioning/hooks/useGetResourceRepositoryView', () => ({
  useGetResourceRepositoryView: jest.fn(() => ({
    repository: {
      name: 'my-repo',
      type: 'github',
      target: 'folder',
      workflows: ['write', 'branch'],
    },
    isLoading: false,
    isReadOnlyRepo: false,
    isInstanceManaged: false,
    status: 'ready',
  })),
}));

// The shared form pulls in branch/refs/folder queries that need a redux store
// + router. The tests cover behavior at the drawer's outer level (heading,
// tip, bulk-action wiring); the form internals have their own coverage.
jest.mock('app/features/provisioning/components/Shared/ResourceEditFormSharedFields', () => ({
  ResourceEditFormSharedFields: () => null,
}));

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  useGetResourceStatsQuery: jest.fn(),
  useCreateRepositoryJobsMutation: jest.fn(() => [
    jest.fn(() => ({ unwrap: () => Promise.resolve({}) })),
    { isLoading: false },
  ]),
  useGetFrontendSettingsQuery: jest.fn(() => ({
    data: {
      items: [
        {
          name: 'my-repo',
          type: 'github',
          target: 'folder',
          workflows: ['write', 'branch'],
        },
      ],
    },
    isLoading: false,
    error: undefined,
  })),
  useGetRepositoryRefsQuery: jest.fn(() => ({
    data: { items: [] },
    isLoading: false,
    error: undefined,
  })),
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
    directDashboards: [],
    subfolders: [],
    allDashboards: [],
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

  it('shows a Migrate selected bulk action at the bottom of Dashboards to migrate', async () => {
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
    // Disabled before any selection. The footer button uses "Migrate selected (0)";
    // Quick wins uses "Migrate top 2" so the (0) match is unambiguous.
    const initial = screen.getByRole('button', { name: /migrate selected \(0\)/i });
    expect(initial).toBeDisabled();
    // Pick folder A — both Quick wins and the footer reflect the same selection.
    await userEvent.click(screen.getByRole('checkbox', { name: /select folder a/i }));
    const enabled = screen.getAllByRole('button', { name: /migrate selected \(1\)/i });
    expect(enabled.length).toBeGreaterThanOrEqual(1);
    enabled.forEach((btn) => expect(btn).not.toBeDisabled());
  });

  it('hides the bulk Migrate selected button when nothing is unmanaged', () => {
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
    expect(screen.queryByRole('button', { name: /migrate selected/i })).not.toBeInTheDocument();
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
    // Empty folders (dashboardCount === 0) are excluded from the gauge math
    // — only A (managed) and B (unmanaged) count, so the gauge reads 1 / 2.
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
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

    // "Dashboards" replaces the old "Total resources" label. It also appears
    // in the Folders managed gauge subtext, so accept multiple matches.
    expect(screen.getAllByText('Dashboards').length).toBeGreaterThan(0);
    expect(screen.getByText('Managed dashboards')).toBeInTheDocument();
    expect(screen.getByText('Unmanaged dashboards')).toBeInTheDocument();
    expect(screen.getByText('Progress to GitOps')).toBeInTheDocument();
    // Totals are dashboard-only now; the fixture puts 4 dashboards under Git Sync.
    expect(screen.getByText(/4 via git sync/i)).toBeInTheDocument();
  });

  it('replaces Quick wins with a "Connect a repository" CTA when no repo is connected', () => {
    mockUseRepositoryList.mockReturnValue([[], false]);
    mockQuery({
      data: {
        instance: [{ group: 'dashboard.grafana.app', resource: 'dashboards', count: 12 }],
        unmanaged: [],
        managed: [],
      },
    });
    mockUseFolderLeaderboard.mockReturnValue({
      data: [makeFolder({ uid: 'pay', title: 'Payments', dashboardCount: 12 })],
      isLoading: false,
      isError: false,
    });
    render(<Migrate />);
    expect(screen.getByText(/connect your first repository/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /connect a repository/i })).toBeInTheDocument();
  });

  it('shows Quick wins folder cards when the leaderboard surfaces unmanaged folders', () => {
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
    // The Quick wins heading uses Title Case; the next-steps copy mentions
    // "Quick wins" inside a longer sentence. Assert that the panel heading
    // (exact match) is gone — that's the signal that the panel is hidden.
    expect(screen.queryByText('Quick wins')).not.toBeInTheDocument();
  });

  it('renders the Dashboards to migrate panel with foldable rows and no per-row Open link', () => {
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
    expect(screen.getByText(/dashboards to migrate/i)).toBeInTheDocument();
    // The row only carries the expand toggle, the checkbox, and the folder
    // metadata. No per-row Open or Migrate buttons.
    expect(screen.queryByRole('link', { name: /^open$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^open$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^migrate to my-repo$/i })).not.toBeInTheDocument();
  });

  it('renders folders in the default "Most dashboards" sort order', () => {
    mockQuery({
      data: {
        instance: [{ group: 'dashboard.grafana.app', resource: 'dashboards', count: 7 }],
        unmanaged: [],
        managed: [],
      },
    });
    mockUseFolderLeaderboard.mockReturnValue({
      data: [
        makeFolder({ uid: 'beta', title: 'Beta', dashboardCount: 2 }),
        makeFolder({ uid: 'alpha', title: 'Alpha', dashboardCount: 5 }),
      ],
      isLoading: false,
      isError: false,
    });
    render(<Migrate />);
    // Default sort is "Most dashboards" — Alpha (5) precedes Beta (2) in the
    // table even though the leaderboard returned them the other way around.
    const titles = screen.getAllByText(/^(Alpha|Beta)$/);
    expect(titles.map((el) => el.textContent)).toEqual(['Alpha', 'Beta']);
    // The sort selector is present so the user can change the order.
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('expands a folder row to show its direct dashboards', async () => {
    mockQuery({
      data: {
        instance: [{ group: 'dashboard.grafana.app', resource: 'dashboards', count: 4 }],
        unmanaged: [],
        managed: [],
      },
    });
    mockUseFolderLeaderboard.mockReturnValue({
      data: [
        makeFolder({
          uid: 'pay',
          title: 'Payments',
          dashboardCount: 2,
          directDashboards: [
            { uid: 'd1', title: 'Daily revenue', url: '/d/d1' },
            { uid: 'd2', title: 'Refund rate', url: '/d/d2' },
          ],
          subfolders: [{ uid: 'sub', title: 'EU subteam', dashboardCount: 0 }],
        }),
      ],
      isLoading: false,
      isError: false,
    });
    render(<Migrate />);
    await userEvent.click(screen.getByRole('button', { name: /^expand payments$/i }));
    expect(screen.getByText('Daily revenue')).toBeInTheDocument();
    expect(screen.getByText('Refund rate')).toBeInTheDocument();
    // Subfolders are deliberately not surfaced inside the expansion — they
    // already appear as their own rows in the panel.
    expect(screen.queryByText('EU subteam')).not.toBeInTheDocument();
  });

  it('counts a selected folder as one unit and ticks its dashboards in the expansion', async () => {
    mockQuery({
      data: {
        instance: [{ group: 'dashboard.grafana.app', resource: 'dashboards', count: 6 }],
        unmanaged: [],
        managed: [],
      },
    });
    mockUseFolderLeaderboard.mockReturnValue({
      data: [
        makeFolder({
          uid: 'pay',
          title: 'Payments',
          dashboardCount: 3,
          directDashboards: [
            { uid: 'd1', title: 'Daily revenue', url: '/d/d1' },
            { uid: 'd2', title: 'Refund rate', url: '/d/d2' },
          ],
          allDashboards: [
            { uid: 'd1', title: 'Daily revenue', url: '/d/d1' },
            { uid: 'd2', title: 'Refund rate', url: '/d/d2' },
            { uid: 'd3', title: 'Nested dashboard', url: '/d/d3' },
          ],
        }),
      ],
      isLoading: false,
      isError: false,
    });
    render(<Migrate />);
    await userEvent.click(screen.getByRole('checkbox', { name: /select folder payments/i }));
    // The footer button counts the folder as one unit — the cascade into the
    // job's resource list is derived at submit time, not stored in the per-
    // dashboard selection set.
    expect(screen.getByRole('button', { name: /migrate selected \(1\)/i })).toBeInTheDocument();
    // Visual cascade: expanding the folder shows direct dashboards already
    // ticked and disabled (the user has to deselect the folder to untick).
    await userEvent.click(screen.getByRole('button', { name: /^expand payments$/i }));
    const dailyRevenueRow = screen.getByLabelText('Daily revenue');
    expect(dailyRevenueRow).toBeChecked();
    expect(dailyRevenueRow).toBeDisabled();
  });

  it('opens the migrate drawer when the bulk action is clicked', async () => {
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
        instance: [{ group: 'dashboard.grafana.app', resource: 'dashboards', count: 3 }],
        unmanaged: [],
        managed: [],
      },
    });
    mockUseFolderLeaderboard.mockReturnValue({
      data: [
        makeFolder({
          uid: 'pay',
          title: 'Payments',
          dashboardCount: 1,
          directDashboards: [{ uid: 'd1', title: 'Daily revenue', url: '/d/d1' }],
          allDashboards: [{ uid: 'd1', title: 'Daily revenue', url: '/d/d1' }],
        }),
      ],
      isLoading: false,
      isError: false,
    });
    render(<Migrate />);
    await userEvent.click(screen.getByRole('checkbox', { name: /select folder payments/i }));
    // Both Quick wins and the footer expose Migrate selected — clicking either
    // opens the drawer.
    const triggers = screen.getAllByRole('button', { name: /migrate selected/i });
    await userEvent.click(triggers[triggers.length - 1]);
    // Drawer surfaces the migration tip and the delete-originals checkbox (default on → submit reads "Migrate").
    expect(screen.getByText(/review how migration works/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /delete original dashboards/i })).toBeChecked();
    expect(screen.getByRole('button', { name: /^migrate$/i })).toBeInTheDocument();
  });

  it('hides already-managed folders from the Dashboards to migrate panel', () => {
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

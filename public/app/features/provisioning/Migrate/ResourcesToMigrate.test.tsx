import { render, screen } from 'test/test-utils';

import { compareFolders, ResourcesToMigrate } from './ResourcesToMigrate';
import { type FolderRow } from './hooks/useFolderMigrationData';

const folders: FolderRow[] = [
  {
    uid: 'team-a',
    title: 'Team A',
    dashboardCount: 2,
    directDashboards: [
      { uid: 'd1', title: 'Dashboard One', url: '/d/d1' },
      { uid: 'd2', title: 'Dashboard Two', url: '/d/d2' },
    ],
    subfolders: [],
    allDashboards: [
      { uid: 'd1', title: 'Dashboard One', url: '/d/d1' },
      { uid: 'd2', title: 'Dashboard Two', url: '/d/d2' },
    ],
  },
  {
    uid: 'managed',
    title: 'Managed Folder',
    managedBy: 'repo',
    dashboardCount: 3,
    directDashboards: [],
    subfolders: [],
    allDashboards: [],
  },
];

function setup(overrides: Partial<React.ComponentProps<typeof ResourcesToMigrate>> = {}) {
  const props = {
    folders,
    selectedFolderUids: new Set<string>(),
    selectedDashboardUids: new Set<string>(),
    onToggleFolder: jest.fn(),
    onToggleDashboard: jest.fn(),
    selectedCount: 0,
    allSelected: false,
    someSelected: false,
    onToggleSelectAll: jest.fn(),
    onMigrateSelected: jest.fn(),
    migrateDisabled: false,
    ...overrides,
  };
  return { props, ...render(<ResourcesToMigrate {...props} />) };
}

describe('ResourcesToMigrate', () => {
  it('lists unmanaged folders and hides managed ones', () => {
    setup();

    expect(screen.getByText('Resources to migrate')).toBeInTheDocument();
    expect(screen.getByText('Team A')).toBeInTheDocument();
    expect(screen.queryByText('Managed Folder')).not.toBeInTheDocument();
    expect(screen.getByText('Showing 1 of 1 folders')).toBeInTheDocument();
  });

  it('expands a folder to reveal its resources', async () => {
    const { user } = setup();

    expect(screen.queryByText('Dashboard One')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /expand team a/i }));

    expect(screen.getByText('Dashboard One')).toBeInTheDocument();
    expect(screen.getByText('Dashboard Two')).toBeInTheDocument();
  });

  it('toggles a folder selection through the callback', async () => {
    const { props, user } = setup();

    await user.click(screen.getByRole('checkbox', { name: /select folder team a/i }));

    expect(props.onToggleFolder).toHaveBeenCalledWith('team-a');
  });

  it('toggles select-all through the callback', async () => {
    const { props, user } = setup();

    await user.click(screen.getByRole('checkbox', { name: /select all/i }));

    expect(props.onToggleSelectAll).toHaveBeenCalled();
  });

  it('disables the migrate button until something is selected', () => {
    setup({ selectedCount: 0 });

    expect(screen.getByRole('button', { name: /migrate selected \(0\)/i })).toBeDisabled();
  });

  it('shows "Migrate selected (N)" for a partial selection', async () => {
    const { props, user } = setup({ selectedCount: 1 });

    const button = screen.getByRole('button', { name: /migrate selected \(1\)/i });
    expect(button).toBeEnabled();

    await user.click(button);
    expect(props.onMigrateSelected).toHaveBeenCalled();
  });

  it('shows "Migrate all (N)" when everything is selected', () => {
    setup({ selectedCount: 1, allSelected: true, someSelected: true });

    expect(screen.getByRole('button', { name: /migrate all \(1\)/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /migrate selected/i })).not.toBeInTheDocument();
  });

  it('checks the select-all box (not indeterminate) when everything is selected', () => {
    setup({ selectedCount: 1, allSelected: true, someSelected: true });

    const selectAll = screen.getByRole<HTMLInputElement>('checkbox', { name: /select all/i });
    expect(selectAll).toBeChecked();
    expect(selectAll.indeterminate).toBe(false);
  });

  it('marks the select-all box indeterminate on a partial selection', () => {
    setup({ selectedCount: 1, allSelected: false, someSelected: true });

    const selectAll = screen.getByRole<HTMLInputElement>('checkbox', { name: /select all/i });
    expect(selectAll).not.toBeChecked();
    expect(selectAll.indeterminate).toBe(true);
  });

  it('shows a tooltip and keeps the button disabled when no repository is connected', () => {
    setup({ selectedCount: 1, migrateDisabled: true, migrateTooltip: 'Connect a repository before migrating.' });

    // Disabled-with-tooltip buttons render with aria-disabled rather than the
    // native disabled attribute.
    expect(screen.getByRole('button', { name: /migrate selected \(1\)/i })).toHaveAttribute('aria-disabled', 'true');
  });

  it('renders the all-managed empty state when there are no unmanaged folders', () => {
    setup({ folders: [folders[1]] });

    expect(screen.getByText('All folders are already managed.')).toBeInTheDocument();
  });

  describe('search, sort and expansion', () => {
    const twoFolders: FolderRow[] = [
      {
        uid: 'alpha',
        title: 'Alpha',
        dashboardCount: 2,
        directDashboards: [
          { uid: 'a1', title: 'Alpha One', url: '/d/a1' },
          { uid: 'a2', title: 'Alpha Two', url: '/d/a2' },
        ],
        subfolders: [],
        allDashboards: [
          { uid: 'a1', title: 'Alpha One', url: '/d/a1' },
          { uid: 'a2', title: 'Alpha Two', url: '/d/a2' },
        ],
      },
      {
        uid: 'beta',
        title: 'Beta',
        dashboardCount: 5,
        directDashboards: [{ uid: 'b1', title: 'Beta One', url: '/d/b1' }],
        subfolders: [],
        allDashboards: [{ uid: 'b1', title: 'Beta One', url: '/d/b1' }],
      },
    ];

    const folderTitleOrder = () => screen.getAllByText(/^(Alpha|Beta)$/).map((el) => el.textContent);

    it('filters by folder title and by dashboard title', async () => {
      const { user } = setup({ folders: twoFolders });
      const input = screen.getByPlaceholderText(/search folders and resources/i);

      await user.type(input, 'Alpha');
      expect(screen.getByText('Alpha')).toBeInTheDocument();
      expect(screen.queryByText('Beta')).not.toBeInTheDocument();

      await user.clear(input);
      await user.type(input, 'Beta One'); // matches a dashboard inside the Beta folder
      expect(screen.getByText('Beta')).toBeInTheDocument();
      expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
    });

    it('defaults to most-dashboards-first ordering', () => {
      setup({ folders: twoFolders });

      // Default sort key is count-desc: Beta (5) before Alpha (2).
      expect(folderTitleOrder()).toEqual(['Beta', 'Alpha']);
    });

    it('hints to migrate the folder when its dashboards live only in subfolders', async () => {
      const subfoldersOnly: FolderRow = {
        uid: 'parent',
        title: 'Parent',
        dashboardCount: 3,
        directDashboards: [],
        subfolders: [{ uid: 'child', title: 'Child', dashboardCount: 3 }],
        allDashboards: [{ uid: 'c1', title: 'C1', url: '/d/c1' }],
      };
      const { user } = setup({ folders: [subfoldersOnly] });

      await user.click(screen.getByRole('button', { name: /expand parent/i }));

      expect(screen.getByText(/live in subfolders/i)).toBeInTheDocument();
    });

    it('locks a folder’s dashboards as checked when the folder itself is selected', async () => {
      const { user } = setup({ selectedFolderUids: new Set(['team-a']) });

      await user.click(screen.getByRole('button', { name: /expand team a/i }));

      const dashboard = screen.getByRole('checkbox', { name: 'Dashboard One' });
      expect(dashboard).toBeChecked();
      expect(dashboard).toBeDisabled();
    });
  });

  describe('compareFolders', () => {
    const big = folders[0]; // Team A, 2 dashboards
    const small: FolderRow = { ...big, uid: 'z', title: 'Zeta', dashboardCount: 1 };

    it('orders by dashboard count descending then ascending', () => {
      expect(compareFolders(big, small, 'count-desc')).toBeLessThan(0);
      expect(compareFolders(big, small, 'count-asc')).toBeGreaterThan(0);
    });

    it('breaks count ties by title', () => {
      const tie: FolderRow = { ...big, uid: 'a-tie', title: 'AAA' };
      expect(compareFolders(big, tie, 'count-desc')).toBeGreaterThan(0); // "Team A" after "AAA"
      expect(compareFolders(big, tie, 'count-asc')).toBeGreaterThan(0);
    });

    it('orders by title ascending and descending', () => {
      expect(compareFolders(big, small, 'title-asc')).toBeLessThan(0); // Team A before Zeta
      expect(compareFolders(big, small, 'title-desc')).toBeGreaterThan(0);
    });
  });
});

import { render, screen } from 'test/test-utils';

import { ResourcesToMigrate } from './ResourcesToMigrate';
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
});

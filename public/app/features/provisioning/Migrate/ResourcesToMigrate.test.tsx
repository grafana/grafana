import { render, screen } from 'test/test-utils';

import { resourceKindInfos } from '../utils/resourceKinds';

import { ResourcesToMigrate } from './ResourcesToMigrate';
import { type FolderRow } from './hooks/useFolderMigrationData';

const folders: FolderRow[] = [
  {
    uid: 'team-a',
    title: 'Team A',
    resourceCount: 2,
    directResources: [
      { uid: 'd1', title: 'Dashboard One', kind: resourceKindInfos.dashboard },
      { uid: 'd2', title: 'Dashboard Two', kind: resourceKindInfos.dashboard },
    ],
  },
];

function setup(overrides: Partial<React.ComponentProps<typeof ResourcesToMigrate>> = {}) {
  const props = {
    folders,
    selectedFolderUids: new Set<string>(),
    selectedResourceKeys: new Set<string>(),
    onToggleFolder: jest.fn(),
    onToggleResource: jest.fn(),
    selectedCount: 0,
    allSelected: false,
    onSetFoldersSelected: jest.fn(),
    onMigrateSelected: jest.fn(),
    submitDisabled: false,
    canMigrate: true,
    connectAction: <button>Connect a repository</button>,
    ...overrides,
  };
  return { props, ...render(<ResourcesToMigrate {...props} />) };
}

describe('ResourcesToMigrate', () => {
  it('lists the folders it is given', () => {
    setup();

    expect(screen.getByText('Resources to migrate')).toBeInTheDocument();
    expect(screen.getByText('Team A')).toBeInTheDocument();
    expect(screen.getByText('Showing 1 of 1 folder')).toBeInTheDocument();
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

  it('select-all toggles only the currently visible (filtered) folders', async () => {
    const { props, user } = setup();

    await user.click(screen.getByRole('checkbox', { name: /select all/i }));

    expect(props.onSetFoldersSelected).toHaveBeenCalledWith(['team-a'], true);
  });

  it('disables the migrate button when the selection cannot be submitted', () => {
    setup({ selectedCount: 0, submitDisabled: true });

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
    setup({ selectedCount: 1, allSelected: true });

    expect(screen.getByRole('button', { name: /migrate all \(1\)/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /migrate selected/i })).not.toBeInTheDocument();
  });

  it('checks the select-all box (not indeterminate) when every visible folder is selected', () => {
    setup({ selectedFolderUids: new Set(['team-a']) });

    const selectAll = screen.getByRole<HTMLInputElement>('checkbox', { name: /select all/i });
    expect(selectAll).toBeChecked();
    expect(selectAll.indeterminate).toBe(false);
  });

  it('shows the connect action instead of a dead migrate button when migration is not possible', () => {
    setup({
      selectedCount: 1,
      canMigrate: false,
      connectAction: <button>Connect a repository</button>,
    });

    expect(screen.getByRole('button', { name: /connect a repository/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /migrate selected/i })).not.toBeInTheDocument();
  });

  it('renders the all-managed empty state when there are no folders to migrate', () => {
    setup({ folders: [] });

    expect(screen.getByText('All supported resources are already managed by Git.')).toBeInTheDocument();
  });

  describe('folder-less kinds grouped under a synthetic folder', () => {
    // Playlists aren't folder-scoped; the caller groups them under a synthetic
    // "Playlists" folder, which the table renders like any other folder.
    const withPlaylists: FolderRow[] = [
      ...folders,
      {
        uid: '__playlists__',
        title: 'Playlists',
        resourceCount: 2,
        directResources: [
          { uid: 'p1', title: 'Morning rotation', kind: resourceKindInfos.playlist },
          { uid: 'p2', title: 'Ops wall', kind: resourceKindInfos.playlist },
        ],
      },
    ];

    it('renders the synthetic folder and reveals its resources when expanded', async () => {
      const { user } = setup({ folders: withPlaylists });

      expect(screen.getByText('Playlists')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /expand playlists/i }));
      expect(screen.getByText('Morning rotation')).toBeInTheDocument();
      expect(screen.getByText('Ops wall')).toBeInTheDocument();
    });

    it('toggles an individual resource inside the synthetic folder', async () => {
      const { props, user } = setup({ folders: withPlaylists });

      await user.click(screen.getByRole('button', { name: /expand playlists/i }));
      await user.click(screen.getByRole('checkbox', { name: 'Morning rotation' }));

      // Selection is keyed by group/kind/name, not the bare uid.
      expect(props.onToggleResource).toHaveBeenCalledWith('playlist.grafana.app/Playlist/p1');
    });

    it('select-all spans every visible folder, synthetic included', async () => {
      const { props, user } = setup({ folders: withPlaylists });

      await user.click(screen.getByRole('checkbox', { name: /select all/i }));

      // Order follows the default count-desc sort; the two folders tie on count
      // (2 each), so they fall back to title order ("Playlists" before "Team A").
      expect(props.onSetFoldersSelected).toHaveBeenCalledWith(['__playlists__', 'team-a'], true);
    });
  });

  describe('search, sort and expansion', () => {
    const twoFolders: FolderRow[] = [
      {
        uid: 'alpha',
        title: 'Alpha',
        resourceCount: 2,
        directResources: [
          { uid: 'a1', title: 'Alpha One', kind: resourceKindInfos.dashboard },
          { uid: 'a2', title: 'Alpha Two', kind: resourceKindInfos.dashboard },
        ],
      },
      {
        uid: 'beta',
        title: 'Beta',
        resourceCount: 5,
        directResources: [{ uid: 'b1', title: 'Beta One', kind: resourceKindInfos.dashboard }],
      },
    ];

    const folderTitleOrder = () => screen.getAllByText(/^(Alpha|Beta)$/).map((el) => el.textContent);

    it('filters by folder title and by resource title', async () => {
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

    it('defaults to most-resources-first ordering', () => {
      setup({ folders: twoFolders });

      // Default sort key is count-desc: Beta (5) before Alpha (2).
      expect(folderTitleOrder()).toEqual(['Beta', 'Alpha']);
    });

    it('collapses an expanded folder', async () => {
      const { user } = setup();

      await user.click(screen.getByRole('button', { name: /expand team a/i }));
      expect(screen.getByText('Dashboard One')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /collapse team a/i }));
      expect(screen.queryByText('Dashboard One')).not.toBeInTheDocument();
    });

    it('re-sorts when the sort control changes', async () => {
      const { user } = setup({ folders: twoFolders });

      // Default count-desc puts Beta (5) before Alpha (2); switching to A–Z flips it.
      expect(folderTitleOrder()).toEqual(['Beta', 'Alpha']);

      // The sort control is the only combobox in this panel. Navigate to the
      // "Fewest resources" option (count-asc) with the keyboard — the menu is
      // virtualized, so keyboard selection is more reliable than clicking.
      const sort = screen.getByRole('combobox');
      await user.click(sort);
      await user.keyboard('{ArrowDown}{Enter}');

      // count-asc puts Alpha (2) before Beta (5), flipping the default order.
      expect(folderTitleOrder()).toEqual(['Alpha', 'Beta']);
    });

    it('marks select-all indeterminate when only some visible folders are selected', () => {
      setup({ folders: twoFolders, selectedFolderUids: new Set(['alpha']) });

      const selectAll = screen.getByRole<HTMLInputElement>('checkbox', { name: /select all/i });
      expect(selectAll).not.toBeChecked();
      expect(selectAll.indeterminate).toBe(true);
    });

    it('scopes select-all to the filtered folders when a search is active', async () => {
      const { props, user } = setup({ folders: twoFolders });

      await user.type(screen.getByPlaceholderText(/search folders and resources/i), 'Alpha');
      await user.click(screen.getByRole('checkbox', { name: /select all/i }));

      // Only the visible (matching) folder is toggled, not Beta.
      expect(props.onSetFoldersSelected).toHaveBeenCalledWith(['alpha'], true);
    });

    it('locks a folder’s resources as checked when the folder itself is selected', async () => {
      const { user } = setup({ selectedFolderUids: new Set(['team-a']) });

      await user.click(screen.getByRole('button', { name: /expand team a/i }));

      const dashboard = screen.getByRole('checkbox', { name: 'Dashboard One' });
      expect(dashboard).toBeChecked();
      expect(dashboard).toBeDisabled();
    });
  });
});

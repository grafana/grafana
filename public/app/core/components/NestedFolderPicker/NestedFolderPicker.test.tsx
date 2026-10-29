import { http, HttpResponse } from 'msw';
import { act, fireEvent, render, screen, waitFor, within } from 'test/test-utils';

import { config, setBackendSrv } from '@grafana/runtime';
import { getCustomSearchHandler, searchRoute } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { getFolderFixtures, setTestFlags } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { captureRequests } from 'app/features/alerting/unified/mocks/server/events';
import { ManagerKind } from 'app/features/apiserver/types';
import { resolveStarredFolders } from 'app/features/stars/folders';
import { useStarredItems } from 'app/features/stars/hooks';

import { NestedFolderPicker } from './NestedFolderPicker';
import { useFoldersQuery } from './useFoldersQuery';
import { useGetTeamFolders } from './useTeamOwnedFolder';
import { getCustomRootFolderItem } from './utils';

const [folderTree, { folderA, folderB, folderC, folderA_folderA, folderA_folderB, folderA_folderC }] =
  getFolderFixtures();

setupMockServer();
setBackendSrv(backendSrv);

jest.mock('./useFoldersQuery', () => {
  const actual = jest.requireActual('./useFoldersQuery');
  return { ...actual, useFoldersQuery: jest.fn() };
});

jest.mock('./useTeamOwnedFolder', () => {
  const actual = jest.requireActual('./useTeamOwnedFolder');
  return {
    ...actual,
    useGetTeamFolders: jest.fn(),
  };
});

jest.mock('app/features/stars/hooks', () => ({
  ...jest.requireActual('app/features/stars/hooks'),
  useStarredItems: jest.fn(),
}));
jest.mock('app/features/stars/folders', () => ({
  ...jest.requireActual('app/features/stars/folders'),
  resolveStarredFolders: jest.fn(),
}));

describe('NestedFolderPicker', () => {
  const mockOnChange = jest.fn();
  const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
  const useGetTeamFoldersMock = useGetTeamFolders as jest.Mock;
  const useStarredItemsMock = useStarredItems as jest.Mock;
  const resolveStarredFoldersMock = resolveStarredFolders as jest.Mock;
  const useFoldersQueryMock = useFoldersQuery as jest.Mock;
  let originalProvisioningEnabled: boolean;

  beforeAll(() => {
    window.HTMLElement.prototype.scrollIntoView = function () {};
  });

  beforeEach(() => {
    originalProvisioningEnabled = config.provisioningEnabled;
    // These tests were written against the legacy folder tree, so pin the flag off by default.
    // The describes below that need the app-platform tree opt in explicitly.
    // TODO: add app platform folder fixtures and drop this pin, so these tests cover the API
    // that production actually uses.
    setTestFlags({ foldersAppPlatformAPI: false });

    const { useFoldersQuery: realUseFoldersQuery } = jest.requireActual('./useFoldersQuery');
    useFoldersQueryMock.mockImplementation(realUseFoldersQuery);

    useGetTeamFoldersMock.mockReturnValue({
      foldersByTeam: [
        {
          team: { name: 'Team A', avatarUrl: 'https://example.com/avatar.png' },
          folders: [{ name: 'team-folder-1', title: 'Team Folder One' }],
        },
      ],
      isLoading: false,
      error: undefined,
    });

    useStarredItemsMock.mockImplementation((_group: string, _kind: string, options?: { skip?: boolean }) =>
      options?.skip ? { data: undefined, error: undefined } : { data: ['starred-folder-1'], error: undefined }
    );
    resolveStarredFoldersMock.mockResolvedValue([
      { kind: 'folder', uid: 'starred-folder-1', title: 'Starred Folder One' },
    ]);
  });

  afterAll(() => {
    window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });

  afterEach(async () => {
    config.provisioningEnabled = originalProvisioningEnabled;
    await act(async () => {
      setTestFlags({});
    });
    jest.resetAllMocks();
  });

  it('renders a button with the correct label when no folder is selected', async () => {
    render(<NestedFolderPicker onChange={mockOnChange} />);
    expect(await screen.findByRole('button', { name: 'Select folder' })).toBeInTheDocument();
  });

  it('renders a button with the correct label when a folder is selected', async () => {
    render(<NestedFolderPicker onChange={mockOnChange} value={folderA.item.uid} />);
    expect(
      await screen.findByRole('button', { name: `Select folder: ${folderA.item.title} currently selected` })
    ).toBeInTheDocument();
  });

  it('clicking the button opens the folder picker', async () => {
    const { user } = render(<NestedFolderPicker onChange={mockOnChange} />);

    // Open the picker and wait for children to load
    const button = await screen.findByRole('button', { name: 'Select folder' });
    await user.click(button);
    await screen.findByLabelText(folderA.item.title);

    // Select folder button is no longer visible
    expect(screen.queryByRole('button', { name: 'Select folder' })).not.toBeInTheDocument();

    // Search input and folder tree are visible
    expect(screen.getByPlaceholderText('Search folders')).toBeInTheDocument();
    expect(screen.getByLabelText('Dashboards')).toBeInTheDocument();
    expect(screen.getByLabelText(folderA.item.title)).toBeInTheDocument();
    // expect(screen.getByLabelText(folderB.item.title)).toBeInTheDocument();
    expect(screen.getByLabelText(folderC.item.title)).toBeInTheDocument();
  });

  it('can select a folder from the picker', async () => {
    const { user } = render(<NestedFolderPicker onChange={mockOnChange} />);

    // Open the picker and wait for children to load
    const button = await screen.findByRole('button', { name: 'Select folder' });
    await user.click(button);
    await screen.findByLabelText(folderA.item.title);

    await user.click(screen.getByLabelText(folderA.item.title));
    expect(mockOnChange).toHaveBeenCalledWith(folderA.item.uid, folderA.item.title);
  });

  it('shows the repository badge on nested folder search results', async () => {
    config.provisioningEnabled = false;
    server.use(
      getCustomSearchHandler([
        {
          resource: 'folders',
          name: 'repo-root',
          title: 'Repo root',
          managedBy: { kind: 'repo', id: 'repo-1' },
        },
        {
          resource: 'folders',
          name: 'git-sync-child',
          title: 'Git Sync child',
          folder: 'repo-root',
          managedBy: { kind: 'repo', id: 'repo-1' },
        },
        { resource: 'folders', name: 'local-folder', title: 'Local folder' },
      ])
    );

    const { user } = render(<NestedFolderPicker onChange={mockOnChange} />);
    await user.click(await screen.findByRole('button', { name: 'Select folder' }));
    fireEvent.change(screen.getByPlaceholderText('Search folders'), { target: { value: 'folder' } });

    const managedRow = await screen.findByRole('treeitem', { name: 'Git Sync child' });
    const unmanagedRow = await screen.findByRole('treeitem', { name: 'Local folder' });

    expect(within(managedRow).getByTestId('icon-exchange-alt')).toBeInTheDocument();
    expect(within(managedRow).getByText('/Repo root')).toBeInTheDocument();
    expect(within(unmanagedRow).queryByTestId('icon-exchange-alt')).not.toBeInTheDocument();
  });

  it('can clear a selection if clearable is specified', async () => {
    const { user } = render(<NestedFolderPicker clearable value={folderA.item.uid} onChange={mockOnChange} />);

    await user.click(await screen.findByRole('button', { name: 'Clear selection' }));
    expect(mockOnChange).toHaveBeenCalledWith(undefined, undefined);
  });

  it('can select a folder from the picker with the keyboard', async () => {
    const { user } = render(<NestedFolderPicker onChange={mockOnChange} />);
    const button = await screen.findByRole('button', { name: 'Select folder' });

    await user.click(button);

    // First two items are the team folders group and its folder, then the regular tree
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{Enter}');
    expect(mockOnChange).toHaveBeenCalledWith(folderC.item.uid, folderC.item.title);
  });

  it('shows the root folder by default', async () => {
    const { user } = render(<NestedFolderPicker onChange={mockOnChange} />);

    // Open the picker and wait for children to load
    const button = await screen.findByRole('button', { name: 'Select folder' });
    await user.click(button);
    await screen.findByLabelText(folderA.item.title);

    await user.click(screen.getByLabelText('Dashboards'));
    expect(mockOnChange).toHaveBeenCalledWith('', 'Dashboards');
  });

  it('hides the root folder if the prop says so', async () => {
    const { user } = render(<NestedFolderPicker showRootFolder={false} onChange={mockOnChange} />);

    // Open the picker and wait for children to load
    const button = await screen.findByRole('button', { name: 'Select folder' });
    await user.click(button);
    await screen.findByLabelText(folderA.item.title);

    expect(screen.queryByLabelText('Dashboards')).not.toBeInTheDocument();
  });

  it('hides folders specified by UID', async () => {
    const { user } = render(<NestedFolderPicker excludeUIDs={[folderC.item.uid]} onChange={mockOnChange} />);

    // Open the picker and wait for children to load
    const button = await screen.findByRole('button', { name: 'Select folder' });
    await user.click(button);
    await screen.findByLabelText(folderA.item.title);

    expect(screen.queryByLabelText(folderC.item.title)).not.toBeInTheDocument();
  });

  it('applies the folder filter while browsing and keeps the owning root selectable', async () => {
    setTestFlags({ foldersAppPlatformAPI: true, 'grafana.starredFolders': true });

    const rootFolderItem = getCustomRootFolderItem({
      title: 'Infra dashboards',
      managedBy: ManagerKind.Repo,
      managerId: 'infra-dashboards',
      uid: '',
    });
    const ownedFolder = {
      isOpen: false,
      level: 1,
      item: {
        kind: 'folder' as const,
        uid: 'net-core',
        title: 'Network core',
        managedBy: ManagerKind.Repo,
        managerId: 'infra-dashboards',
      },
    };
    const otherRepositoryFolder = {
      isOpen: false,
      level: 1,
      item: {
        kind: 'folder' as const,
        uid: 'billing',
        title: 'Billing',
        managedBy: ManagerKind.Repo,
        managerId: 'finance-dashboards',
      },
    };
    useFoldersQueryMock.mockReturnValue({
      emptyFolders: new Set<string>(),
      items: [
        rootFolderItem,
        ownedFolder,
        otherRepositoryFolder,
        { isOpen: false, level: 1, item: { kind: 'folder', uid: 'local', title: 'Local' } },
        {
          isOpen: false,
          level: 1,
          disabled: true,
          item: { kind: 'folder', uid: 'sharedwithme', title: 'Shared with me' },
        },
      ],
      isLoading: false,
      error: undefined,
      requestNextPage: jest.fn(),
    });
    const folderFilter = (folder: { managedBy?: ManagerKind; managerId?: string }) =>
      folder.managedBy === ManagerKind.Repo && folder.managerId === 'infra-dashboards';

    const { user } = render(
      <NestedFolderPicker rootFolderItem={rootFolderItem} folderFilter={folderFilter} onChange={mockOnChange} />
    );

    await user.click(await screen.findByRole('button', { name: 'Select folder' }));

    expect(screen.getByLabelText('Network core')).toBeInTheDocument();
    expect(screen.queryByLabelText('Billing')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Local')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Team folders')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Starred folders')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Shared with me')).not.toBeInTheDocument();

    await user.click(screen.getByLabelText('Infra dashboards'));
    expect(mockOnChange).toHaveBeenCalledWith('', 'Infra dashboards');
  });

  it('labels a selected custom root with its own title', async () => {
    config.provisioningEnabled = false;
    const rootFolderItem = getCustomRootFolderItem({
      title: 'Infra dashboards',
      managedBy: ManagerKind.Repo,
      managerId: 'infra-dashboards',
      uid: '',
    });

    render(<NestedFolderPicker value="" rootFolderItem={rootFolderItem} onChange={mockOnChange} />);

    expect(
      await screen.findByRole('button', { name: 'Select folder: Infra dashboards currently selected' })
    ).toBeInTheDocument();
  });

  it('applies the folder filter to typed search results', async () => {
    config.provisioningEnabled = false;
    server.use(
      getCustomSearchHandler([
        {
          resource: 'folders',
          name: 'active-repo-folder',
          title: 'Active repository folder',
          managedBy: { kind: 'repo', id: 'folderless-repo' },
        },
        {
          resource: 'folders',
          name: 'other-repo-folder',
          title: 'Other repository folder',
          managedBy: { kind: 'repo', id: 'other-repo' },
        },
        { resource: 'folders', name: 'unmanaged-folder', title: 'Unmanaged folder' },
      ])
    );

    const folderFilter = (folder: { managedBy?: ManagerKind; managerId?: string }) =>
      folder.managedBy === ManagerKind.Repo && folder.managerId === 'folderless-repo';
    const { user } = render(<NestedFolderPicker folderFilter={folderFilter} onChange={mockOnChange} />);

    await user.click(await screen.findByRole('button', { name: 'Select folder' }));
    fireEvent.change(screen.getByPlaceholderText('Search folders'), { target: { value: 'repository' } });

    expect(await screen.findByLabelText('Active repository folder')).toBeInTheDocument();
    expect(screen.queryByLabelText('Other repository folder')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Unmanaged folder')).not.toBeInTheDocument();
  });

  it('keeps the team and starred sections for a local move and hides their managed children', async () => {
    setTestFlags({ foldersAppPlatformAPI: true, 'grafana.starredFolders': true });
    useGetTeamFoldersMock.mockReturnValue({
      foldersByTeam: [
        {
          team: { name: 'Team A' },
          folders: [
            { name: 'team-local', title: 'Team local' },
            {
              name: 'team-managed',
              title: 'Team managed',
              managedBy: { kind: ManagerKind.Repo, id: 'infra-dashboards' },
            },
          ],
        },
      ],
      isLoading: false,
      error: undefined,
    });
    resolveStarredFoldersMock.mockResolvedValue([
      { kind: 'folder', uid: 'starred-local', title: 'Starred local' },
      {
        kind: 'folder',
        uid: 'starred-managed',
        title: 'Starred managed',
        managedBy: ManagerKind.Repo,
        managerId: 'infra-dashboards',
      },
    ]);
    useFoldersQueryMock.mockReturnValue({
      emptyFolders: new Set<string>(),
      items: [{ isOpen: true, level: 0, item: { kind: 'folder', uid: '', title: 'Dashboards' } }],
      isLoading: false,
      error: undefined,
      requestNextPage: jest.fn(),
    });
    const folderFilter = (folder: { managedBy?: ManagerKind }) => folder.managedBy !== ManagerKind.Repo;

    const { user } = render(<NestedFolderPicker folderFilter={folderFilter} onChange={mockOnChange} />);
    await user.click(await screen.findByRole('button', { name: 'Select folder' }));

    expect(await screen.findByLabelText('Team folders')).toBeInTheDocument();
    expect(screen.getByLabelText('Team local')).toBeInTheDocument();
    expect(screen.queryByLabelText('Team managed')).not.toBeInTheDocument();
    expect(await screen.findByLabelText('Starred folders')).toBeInTheDocument();
    expect(screen.getByLabelText('Starred local')).toBeInTheDocument();
    expect(screen.queryByLabelText('Starred managed')).not.toBeInTheDocument();
  });

  it('by default only shows items the user can edit', async () => {
    const { user } = render(<NestedFolderPicker onChange={mockOnChange} />);

    const button = await screen.findByRole('button', { name: 'Select folder' });
    await user.click(button);
    await screen.findByLabelText(folderA.item.title);

    expect(screen.queryByLabelText(folderB.item.title)).not.toBeInTheDocument(); // folderB is not editable
    expect(screen.getByLabelText(folderC.item.title)).toBeInTheDocument(); // but folderC is
  });

  it('shows items the user can view, with the prop', async () => {
    const { user } = render(<NestedFolderPicker permission="view" onChange={mockOnChange} />);

    const button = await screen.findByRole('button', { name: 'Select folder' });
    await user.click(button);
    await screen.findByLabelText(folderA.item.title);

    expect(screen.getByLabelText(folderB.item.title)).toBeInTheDocument();
    expect(screen.getByLabelText(folderC.item.title)).toBeInTheDocument();
  });

  it('can expand and collapse a folder to show its children', async () => {
    const { user } = render(<NestedFolderPicker permission="view" onChange={mockOnChange} />);

    // Open the picker and wait for children to load
    const button = await screen.findByRole('button', { name: 'Select folder' });
    await user.click(button);
    await screen.findByLabelText(folderA.item.title);

    // Expand Folder A
    // Note: we need to use mouseDown here because userEvent's click event doesn't get prevented correctly
    fireEvent.mouseDown(screen.getByRole('button', { name: `Expand folder ${folderA.item.title}` }));

    // Folder A's children are visible
    expect(await screen.findByLabelText(folderA_folderA.item.title)).toBeInTheDocument();
    expect(await screen.findByLabelText(folderA_folderB.item.title)).toBeInTheDocument();

    // Collapse Folder A
    // Note: we need to use mouseDown here because userEvent's click event doesn't get prevented correctly
    fireEvent.mouseDown(screen.getByRole('button', { name: `Collapse folder ${folderA.item.title}` }));
    expect(screen.queryByLabelText(folderA_folderA.item.title)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(folderA_folderB.item.title)).not.toBeInTheDocument();

    // Expand Folder A again
    // Note: we need to use mouseDown here because userEvent's click event doesn't get prevented correctly
    fireEvent.mouseDown(screen.getByRole('button', { name: `Expand folder ${folderA.item.title}` }));

    // Select the first child
    await user.click(screen.getByLabelText(folderA_folderA.item.title));
    expect(mockOnChange).toHaveBeenCalledWith(folderA_folderA.item.uid, folderA_folderA.item.title);
  });

  it('can expand and collapse a folder to show its children with the keyboard', async () => {
    const { user } = render(<NestedFolderPicker permission="view" onChange={mockOnChange} />);
    const button = await screen.findByRole('button', { name: 'Select folder' });

    await user.click(button);

    // Expand Folder A (first two items are the team folders group and its folder)
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowRight}');

    // Folder A's children are visible
    expect(await screen.findByLabelText(folderA_folderA.item.title)).toBeInTheDocument();
    expect(await screen.findByLabelText(folderA_folderB.item.title)).toBeInTheDocument();
    expect(await screen.findByLabelText(folderA_folderC.item.title)).toBeInTheDocument();

    // Collapse Folder A
    await user.keyboard('{ArrowLeft}');
    expect(screen.queryByLabelText(folderA_folderA.item.title)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(folderA_folderB.item.title)).not.toBeInTheDocument();

    // Expand Folder A again
    await user.keyboard('{ArrowRight}');

    // Select the first child
    await user.keyboard('{ArrowDown}{Enter}');
    expect(mockOnChange).toHaveBeenCalledWith(folderA_folderC.item.uid, folderA_folderC.item.title);
  });

  it('shows an error when folder browsing fails', async () => {
    useFoldersQueryMock.mockReturnValue({
      emptyFolders: new Set<string>(),
      items: [],
      isLoading: false,
      error: new Error('Failed to load folders'),
      requestNextPage: jest.fn(),
    });

    const { user } = render(<NestedFolderPicker onChange={mockOnChange} />);
    await user.click(await screen.findByRole('button', { name: 'Select folder' }));

    expect(await screen.findByText('Error loading some folders')).toBeInTheDocument();
    expect(screen.getByText('Failed to load folders')).toBeInTheDocument();
  });

  describe('team folders', () => {
    it('shows team folders', async () => {
      const { user } = render(<NestedFolderPicker onChange={mockOnChange} />);
      await user.click(await screen.findByRole('button', { name: 'Select folder' }));

      expect(await screen.findByLabelText('Team folders')).toBeInTheDocument();
      expect(await screen.findByLabelText('Team Folder One')).toBeInTheDocument();
    });

    it('shows an error when team folders fail to load', async () => {
      useGetTeamFoldersMock.mockReturnValue({
        foldersByTeam: [],
        isLoading: false,
        error: new Error('Team folders failed'),
      });

      const { user } = render(<NestedFolderPicker onChange={mockOnChange} />);
      await user.click(await screen.findByRole('button', { name: 'Select folder' }));

      expect(await screen.findByText('Error loading team folders')).toBeInTheDocument();
      expect(await screen.findByText('Team folders failed')).toBeInTheDocument();
      expect(await screen.findByLabelText('Dashboards')).toBeInTheDocument();
      expect(await screen.findByLabelText(folderA.item.title)).toBeInTheDocument();
      expect(screen.queryByLabelText('Team folders')).not.toBeInTheDocument();
    });

    it('shows team folders at top level when root folder is hidden', async () => {
      const { user } = render(<NestedFolderPicker showRootFolder={false} onChange={mockOnChange} />);
      await user.click(await screen.findByRole('button', { name: 'Select folder' }));

      const teamFolders = await screen.findByLabelText('Team folders');
      const topLevelFolder = await screen.findByLabelText(folderA.item.title);

      expect(screen.queryByLabelText('Dashboards')).not.toBeInTheDocument();
      expect(teamFolders).toBeInTheDocument();
      expect(await screen.findByLabelText('Team Folder One')).toBeInTheDocument();
      expect(teamFolders.getAttribute('aria-level')).toBe(topLevelFolder.getAttribute('aria-level'));
    });

    it('does not auto-select a team folder when root is selected and shown', () => {
      render(<NestedFolderPicker value="" onChange={mockOnChange} />);

      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('does auto-select a team folder when root is selected but hidden', () => {
      render(<NestedFolderPicker value="" showRootFolder={false} onChange={mockOnChange} />);

      expect(mockOnChange).toHaveBeenCalled();
    });

    it('does not auto-select a team folder when no value', () => {
      render(<NestedFolderPicker onChange={mockOnChange} />);

      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('hides team folders when rootFolderUID is set', async () => {
      const { user } = render(<NestedFolderPicker rootFolderUID="my-repo" onChange={mockOnChange} />);
      await user.click(await screen.findByRole('button', { name: 'Select folder' }));

      expect(screen.queryByLabelText('Team folders')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Team Folder One')).not.toBeInTheDocument();
    });
  });

  describe('when starredFolders is enabled', () => {
    beforeEach(() => {
      setTestFlags({ 'grafana.starredFolders': true, foldersAppPlatformAPI: true });
    });

    afterEach(async () => {
      await act(async () => {
        setTestFlags({});
      });
    });

    it('shows the starred folders virtual root with its selectable children', async () => {
      const { user } = render(<NestedFolderPicker onChange={mockOnChange} />);
      await user.click(await screen.findByRole('button', { name: 'Select folder' }));

      const starredContainer = await screen.findByLabelText('Starred folders');
      const starredChild = await screen.findByLabelText('Starred Folder One');

      expect(starredContainer).toBeInTheDocument();
      expect(starredChild).toBeInTheDocument();
      // The starred children sit one level below the virtual root container.
      expect(Number(starredChild.getAttribute('aria-level'))).toBe(
        Number(starredContainer.getAttribute('aria-level')) + 1
      );
    });

    it('selects the real folder UID when a starred child is picked', async () => {
      const { user } = render(<NestedFolderPicker onChange={mockOnChange} />);
      await user.click(await screen.findByRole('button', { name: 'Select folder' }));

      await user.click(await screen.findByLabelText('Starred Folder One'));

      expect(mockOnChange).toHaveBeenCalledWith('starred-folder-1', 'Starred Folder One');
    });

    it('forwards the picker permission to starred folder resolution', async () => {
      const { user } = render(<NestedFolderPicker permission="view" onChange={mockOnChange} />);
      await user.click(await screen.findByRole('button', { name: 'Select folder' }));

      await waitFor(() => expect(resolveStarredFoldersMock).toHaveBeenCalledWith(['starred-folder-1'], 'view'));
    });

    it('defaults to edit permission when no permission prop is set', async () => {
      const { user } = render(<NestedFolderPicker onChange={mockOnChange} />);
      await user.click(await screen.findByRole('button', { name: 'Select folder' }));

      await waitFor(() => expect(resolveStarredFoldersMock).toHaveBeenCalledWith(['starred-folder-1'], 'edit'));
    });
  });

  describe('when starredFolders is enabled but foldersAppPlatformAPI is disabled', () => {
    beforeEach(() => {
      setTestFlags({ 'grafana.starredFolders': true, foldersAppPlatformAPI: false });
    });

    afterEach(async () => {
      await act(async () => {
        setTestFlags({});
      });
    });

    it('does not render starred folders (hard gate on the app-platform folder API)', async () => {
      const { user } = render(<NestedFolderPicker onChange={mockOnChange} />);
      await user.click(await screen.findByRole('button', { name: 'Select folder' }));

      // Anchor on a real folder to confirm the tree rendered before asserting starred absence.
      expect(await screen.findByLabelText(folderA.item.title)).toBeInTheDocument();
      expect(screen.queryByLabelText('Starred folders')).toBeNull();
      expect(screen.queryByLabelText('Starred Folder One')).toBeNull();
    });
  });

  describe('read only folders', () => {
    const readOnlyFlags = { 'grafana.folderPickerFolderEditAccess': true, foldersAppPlatformAPI: true };

    // The shared mock search handler ignores `include`, so answer with every folder marked as the server would
    function usePathToCreatableHandler(creatableNames: string[]) {
      const hits = folderTree.flatMap(({ item }) =>
        item.kind === 'folder'
          ? [
              {
                resource: 'folders',
                name: item.uid,
                title: item.title,
                folder: item.parentUID,
                field: { canCreate: creatableNames.includes(item.uid) },
              },
            ]
          : []
      );
      server.use(getCustomSearchHandler(hits));
    }

    beforeEach(() => {
      usePathToCreatableHandler([folderA.item.uid]);
    });

    it('shows folders the user cannot pick as read only, and does not select them', async () => {
      setTestFlags(readOnlyFlags);
      const { user } = render(<NestedFolderPicker onChange={mockOnChange} />);
      await user.click(await screen.findByRole('button', { name: 'Select folder' }));

      const readOnlyRow = await screen.findByRole('treeitem', { name: new RegExp(folderC.item.title) });
      expect(within(readOnlyRow).getByRole('img', { name: 'Read only' })).toBeInTheDocument();
      expect(readOnlyRow).toHaveAttribute('aria-disabled', 'true');

      await user.click(within(readOnlyRow).getByText(folderC.item.title));
      expect(mockOnChange).not.toHaveBeenCalled();

      const editableRow = screen.getByRole('treeitem', { name: folderA.item.title });
      expect(within(editableRow).queryByRole('img', { name: 'Read only' })).not.toBeInTheDocument();
      await user.click(within(editableRow).getByText(folderA.item.title));
      expect(mockOnChange).toHaveBeenCalledWith(folderA.item.uid, folderA.item.title);
    });

    it('asks the server for the path to creatable folders instead of filtering by permission', async () => {
      setTestFlags(readOnlyFlags);
      const capture = captureRequests((request) => request.url.includes('/search'));
      const { user } = render(<NestedFolderPicker onChange={mockOnChange} />);
      await user.click(await screen.findByRole('button', { name: 'Select folder' }));
      await screen.findByRole('treeitem', { name: new RegExp(folderC.item.title) });

      const treeSearches = (await capture)
        .map((request) => new URL(request.url).searchParams)
        .filter((params) => params.get('folder') === 'general');
      expect(treeSearches.length).toBeGreaterThan(0);
      for (const params of treeSearches) {
        expect(params.get('include')).toBe('pathToCreatable');
        expect(params.get('permission')).toBeNull();
      }
    });

    it('does not select a read only folder with the keyboard', async () => {
      setTestFlags(readOnlyFlags);
      const { user } = render(<NestedFolderPicker onChange={mockOnChange} />);
      await user.click(await screen.findByRole('button', { name: 'Select folder' }));

      const readOnlyRow = await screen.findByRole('treeitem', { name: new RegExp(folderC.item.title) });
      const input = screen.getByRole('combobox');
      for (let i = 0; i < 20 && input.getAttribute('aria-activedescendant') !== readOnlyRow.id; i++) {
        await user.keyboard('{ArrowDown}');
      }
      expect(input).toHaveAttribute('aria-activedescendant', readOnlyRow.id);

      await user.keyboard('{Enter}');
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('marks typed search results the server says the user cannot create in as read only', async () => {
      setTestFlags(readOnlyFlags);
      server.use(
        http.get(searchRoute, ({ request }) => {
          const params = new URL(request.url).searchParams;
          if (params.get('include') !== 'pathToCreatable' || !params.get('query')?.includes('searchable')) {
            return undefined;
          }
          const hits = [
            {
              resource: 'folders',
              name: 'searchable-editable',
              title: 'Searchable editable',
              field: { canCreate: true },
            },
            { resource: 'folders', name: 'searchable-path', title: 'Searchable path', field: { canCreate: false } },
          ];
          return HttpResponse.json({ totalHits: hits.length, hits });
        })
      );

      const { user } = render(<NestedFolderPicker onChange={mockOnChange} />);
      await user.click(await screen.findByRole('button', { name: 'Select folder' }));
      fireEvent.change(screen.getByPlaceholderText('Search folders'), { target: { value: 'searchable' } });

      const pathOnlyRow = await screen.findByRole('treeitem', { name: /Searchable path/ });
      expect(within(pathOnlyRow).getByRole('img', { name: 'Read only' })).toBeInTheDocument();
      expect(
        within(screen.getByRole('treeitem', { name: /Searchable editable/ })).queryByRole('img', { name: 'Read only' })
      ).not.toBeInTheDocument();
    });

    it.each<{ name: string; flags: Parameters<typeof setTestFlags>[0]; permission?: 'view' | 'edit' }>([
      { name: 'the feature flag is off', flags: { foldersAppPlatformAPI: true } },
      {
        name: 'the app platform folders API is off',
        flags: { 'grafana.folderPickerFolderEditAccess': true, foldersAppPlatformAPI: false },
      },
      { name: 'the picker lists folders the user can view', flags: readOnlyFlags, permission: 'view' },
    ])('does not show read only folders when $name', async ({ flags, permission }) => {
      setTestFlags(flags);
      const { user } = render(<NestedFolderPicker onChange={mockOnChange} permission={permission} />);
      await user.click(await screen.findByRole('button', { name: 'Select folder' }));

      expect(await screen.findByLabelText(folderA.item.title)).toBeInTheDocument();
      expect(screen.queryByRole('img', { name: 'Read only' })).not.toBeInTheDocument();
    });
  });
});

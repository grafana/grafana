import { assertIsDefined } from 'test/helpers/asserts';
import { render, screen, waitFor, within } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';
import { getFolderFixtures } from '@grafana/test-utils/unstable';
import { ManagerKind } from 'app/features/apiserver/types';

import { sharedWithMeFolder, wellFormedDashboard } from '../fixtures/dashboardsTreeItem.fixture';
import { SelectionState } from '../types';

import { DashboardsTree } from './DashboardsTree';

const [_, { folderA: folder, folderB_empty: emptyFolderIndicator, dashbdD: dashboard }] = getFolderFixtures();

describe('browse-dashboards DashboardsTree', () => {
  const WIDTH = 800;
  const HEIGHT = 600;
  const mockPermissions = {
    canEditFolders: true,
    canEditDashboards: true,
    canDeleteFolders: true,
    canDeleteDashboards: true,
  };

  const noop = () => {};
  const isSelected = () => SelectionState.Unselected;
  const allItemsAreLoaded = () => true;
  const requestLoadMore = () => Promise.resolve();
  let originalProvisioningEnabled: boolean;

  beforeAll(() => {
    config.sharedWithMeFolderUID = 'sharedwithme';
  });

  beforeEach(() => {
    originalProvisioningEnabled = config.provisioningEnabled;
  });

  afterEach(() => {
    config.provisioningEnabled = originalProvisioningEnabled;
    // Reset permissions back to defaults
    Object.assign(mockPermissions, {
      canEditFolders: true,
      canEditDashboards: true,
      canDeleteFolders: true,
      canDeleteDashboards: true,
    });
  });

  it('renders a dashboard item', () => {
    render(
      <DashboardsTree
        permissions={mockPermissions}
        items={[dashboard]}
        isSelected={isSelected}
        width={WIDTH}
        height={HEIGHT}
        onFolderClick={noop}
        onTagClick={noop}
        onItemSelectionChange={noop}
        onAllSelectionChange={noop}
        isItemLoaded={allItemsAreLoaded}
        requestLoadMore={requestLoadMore}
      />
    );
    expect(screen.getByText(dashboard.item.title)).toBeInTheDocument();
    expect(screen.getByText(assertIsDefined(dashboard.item.tags)[0])).toBeInTheDocument();
    expect(screen.getByTestId(selectors.pages.BrowseDashboards.table.checkbox(dashboard.item.uid))).toBeInTheDocument();
  });

  it('grows the README row to its measured content height', async () => {
    const offsetHeightSpy = jest.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(500);

    render(
      <DashboardsTree
        permissions={mockPermissions}
        items={[
          dashboard,
          { item: { kind: 'ui', uiKind: 'readme', uid: 'folder-readme-folder1' }, level: 0, isOpen: false },
        ]}
        folderUID="folder1"
        isSelected={isSelected}
        width={WIDTH}
        height={HEIGHT}
        onFolderClick={noop}
        onTagClick={noop}
        onItemSelectionChange={noop}
        onAllSelectionChange={noop}
        isItemLoaded={allItemsAreLoaded}
        requestLoadMore={requestLoadMore}
      />
    );

    // 500px measured content + 16px row padding, replacing the 320px estimate.
    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      expect(rows[rows.length - 1]).toHaveStyle({ height: '516px' });
    });

    offsetHeightSpy.mockRestore();
  });

  it('resets the README row height when navigating to another folder', async () => {
    const offsetHeightSpy = jest.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(500);

    const treeFor = (folderUID: string) => (
      <DashboardsTree
        permissions={mockPermissions}
        items={[
          dashboard,
          { item: { kind: 'ui', uiKind: 'readme', uid: `folder-readme-${folderUID}` }, level: 0, isOpen: false },
        ]}
        folderUID={folderUID}
        isSelected={isSelected}
        width={WIDTH}
        height={HEIGHT}
        onFolderClick={noop}
        onTagClick={noop}
        onItemSelectionChange={noop}
        onAllSelectionChange={noop}
        isItemLoaded={allItemsAreLoaded}
        requestLoadMore={requestLoadMore}
      />
    );

    const { rerender } = render(treeFor('folder1'));

    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      expect(rows[rows.length - 1]).toHaveStyle({ height: '516px' });
    });

    // The next panel's 0 measurement is ignored, so the reset restores the estimate.
    offsetHeightSpy.mockReturnValue(0);
    rerender(treeFor('folder2'));

    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      expect(rows[rows.length - 1]).toHaveStyle({ height: '336px' });
    });

    offsetHeightSpy.mockRestore();
  });

  it('does not render checkbox when disabled', () => {
    mockPermissions.canEditFolders = false;
    mockPermissions.canEditDashboards = false;
    mockPermissions.canDeleteFolders = false;
    mockPermissions.canDeleteDashboards = false;

    render(
      <DashboardsTree
        permissions={mockPermissions}
        items={[dashboard]}
        isSelected={isSelected}
        width={WIDTH}
        height={HEIGHT}
        onFolderClick={noop}
        onTagClick={noop}
        onItemSelectionChange={noop}
        onAllSelectionChange={noop}
        isItemLoaded={allItemsAreLoaded}
        requestLoadMore={requestLoadMore}
      />
    );
    expect(
      screen.queryByTestId(selectors.pages.BrowseDashboards.table.checkbox(dashboard.item.uid))
    ).not.toBeInTheDocument();
  });

  it('renders a folder item', () => {
    render(
      <DashboardsTree
        permissions={mockPermissions}
        items={[folder]}
        isSelected={isSelected}
        width={WIDTH}
        height={HEIGHT}
        onFolderClick={noop}
        onTagClick={noop}
        onItemSelectionChange={noop}
        onAllSelectionChange={noop}
        isItemLoaded={allItemsAreLoaded}
        requestLoadMore={requestLoadMore}
      />
    );

    expect(screen.getByText(folder.item.title)).toBeInTheDocument();
  });

  it('shows repository badges only on managed root rows', () => {
    config.provisioningEnabled = false;
    const repositoryRoot = {
      ...folder,
      item: {
        ...folder.item,
        uid: 'repo-root',
        title: 'Repository root',
        managedBy: ManagerKind.Repo,
        managerId: 'repo-1',
        parentUID: undefined,
      },
    };
    const repositoryChild = {
      ...folder,
      item: {
        ...folder.item,
        uid: 'repo-child',
        title: 'Repository child',
        managedBy: ManagerKind.Repo,
        managerId: 'repo-1',
        parentUID: repositoryRoot.item.uid,
      },
      level: repositoryRoot.level + 1,
      parentUID: repositoryRoot.item.uid,
    };

    render(
      <DashboardsTree
        permissions={mockPermissions}
        items={[repositoryRoot, repositoryChild]}
        isSelected={isSelected}
        width={WIDTH}
        height={HEIGHT}
        onFolderClick={noop}
        onTagClick={noop}
        onItemSelectionChange={noop}
        onAllSelectionChange={noop}
        isItemLoaded={allItemsAreLoaded}
        requestLoadMore={requestLoadMore}
      />
    );

    const rootRow = screen.getByTestId(selectors.pages.BrowseDashboards.table.row(repositoryRoot.item.title));
    const childRow = screen.getByTestId(selectors.pages.BrowseDashboards.table.row(repositoryChild.item.title));
    expect(within(rootRow).getByTestId('icon-exchange-alt')).toBeInTheDocument();
    expect(within(childRow).queryByTestId('icon-exchange-alt')).not.toBeInTheDocument();
  });

  it('renders a folder link', () => {
    render(
      <DashboardsTree
        permissions={mockPermissions}
        items={[folder]}
        isSelected={isSelected}
        width={WIDTH}
        height={HEIGHT}
        onFolderClick={noop}
        onTagClick={noop}
        onItemSelectionChange={noop}
        onAllSelectionChange={noop}
        isItemLoaded={allItemsAreLoaded}
        requestLoadMore={requestLoadMore}
      />
    );

    expect(screen.queryByText(folder.item.title)).toHaveAttribute('href', folder.item.url);
  });

  it("doesn't link to the sharedwithme pseudo-folder", () => {
    const sharedWithMe = sharedWithMeFolder(2);

    render(
      <DashboardsTree
        permissions={mockPermissions}
        items={[sharedWithMe, folder]}
        isSelected={isSelected}
        width={WIDTH}
        height={HEIGHT}
        onFolderClick={noop}
        onTagClick={noop}
        onItemSelectionChange={noop}
        onAllSelectionChange={noop}
        isItemLoaded={allItemsAreLoaded}
        requestLoadMore={requestLoadMore}
      />
    );

    expect(screen.queryByText(sharedWithMe.item.title)).not.toHaveAttribute('href');
  });

  it("doesn't render a checkbox for the sharedwithme pseudo-folder", () => {
    const sharedWithMe = sharedWithMeFolder(2);

    render(
      <DashboardsTree
        permissions={mockPermissions}
        items={[sharedWithMe, folder]}
        isSelected={isSelected}
        width={WIDTH}
        height={HEIGHT}
        onFolderClick={noop}
        onTagClick={noop}
        onItemSelectionChange={noop}
        onAllSelectionChange={noop}
        isItemLoaded={allItemsAreLoaded}
        requestLoadMore={requestLoadMore}
      />
    );

    expect(
      screen.queryByTestId(selectors.pages.BrowseDashboards.table.checkbox(sharedWithMe.item.uid))
    ).not.toBeInTheDocument();
  });

  it('calls onFolderClick when a folder button is clicked', async () => {
    const handler = jest.fn();
    const { user } = render(
      <DashboardsTree
        permissions={mockPermissions}
        items={[folder]}
        isSelected={isSelected}
        width={WIDTH}
        height={HEIGHT}
        onFolderClick={handler}
        onTagClick={noop}
        onItemSelectionChange={noop}
        onAllSelectionChange={noop}
        isItemLoaded={allItemsAreLoaded}
        requestLoadMore={requestLoadMore}
      />
    );
    const folderButton = screen.getByLabelText(`Expand folder ${folder.item.title}`);
    await user.click(folderButton);

    expect(handler).toHaveBeenCalledWith(folder.item.uid, true);
  });

  it('renders a description tooltip indicator when the item has a description', () => {
    const dashboardWithDescription = wellFormedDashboard(10, undefined, { description: 'A helpful description' });

    render(
      <DashboardsTree
        permissions={mockPermissions}
        items={[dashboardWithDescription]}
        isSelected={isSelected}
        width={WIDTH}
        height={HEIGHT}
        onFolderClick={noop}
        onTagClick={noop}
        onItemSelectionChange={noop}
        onAllSelectionChange={noop}
        isItemLoaded={allItemsAreLoaded}
        requestLoadMore={requestLoadMore}
      />
    );

    expect(screen.getByLabelText('Description')).toBeInTheDocument();
  });

  it('does not render a description tooltip indicator when the item has no description', () => {
    const dashboardWithoutDescription = wellFormedDashboard(11);

    render(
      <DashboardsTree
        permissions={mockPermissions}
        items={[dashboardWithoutDescription]}
        isSelected={isSelected}
        width={WIDTH}
        height={HEIGHT}
        onFolderClick={noop}
        onTagClick={noop}
        onItemSelectionChange={noop}
        onAllSelectionChange={noop}
        isItemLoaded={allItemsAreLoaded}
        requestLoadMore={requestLoadMore}
      />
    );

    expect(screen.queryByLabelText('Description')).not.toBeInTheDocument();
  });

  it('renders empty folder indicators', () => {
    render(
      <DashboardsTree
        permissions={mockPermissions}
        items={[emptyFolderIndicator]}
        isSelected={isSelected}
        width={WIDTH}
        height={HEIGHT}
        onFolderClick={noop}
        onTagClick={noop}
        onItemSelectionChange={noop}
        onAllSelectionChange={noop}
        isItemLoaded={allItemsAreLoaded}
        requestLoadMore={requestLoadMore}
      />
    );
    expect(screen.getByText('No items')).toBeInTheDocument();
  });
});

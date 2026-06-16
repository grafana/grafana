import { assertIsDefined } from 'test/helpers/asserts';
import { render, screen, waitFor } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { config, setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { getFolderFixtures } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';

import { sharedWithMeFolder } from '../fixtures/dashboardsTreeItem.fixture';
import { SelectionState } from '../types';

import { DashboardsTree } from './DashboardsTree';

setBackendSrv(backendSrv);
setupMockServer();

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

  beforeAll(() => {
    config.sharedWithMeFolderUID = 'sharedwithme';
  });

  afterEach(() => {
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

  describe('folder star button', () => {
    const renderTree = (items: Array<typeof folder>) =>
      render(
        <DashboardsTree
          permissions={mockPermissions}
          items={items}
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

    // Folders use the same star mechanism as dashboards, so the button renders regardless of the toggle
    it('renders a star button for a folder row', async () => {
      renderTree([folder]);

      const starButton = await screen.findByTestId(selectors.components.NavToolbar.markAsFavorite);
      expect(starButton).toBeInTheDocument();
    });

    it('does not render a star button for a dashboard row', async () => {
      renderTree([dashboard]);

      // Wait for the tree to have rendered the row before asserting the absence of the star
      expect(await screen.findByText(dashboard.item.title)).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.queryByTestId(selectors.components.NavToolbar.markAsFavorite)).not.toBeInTheDocument();
      });
    });
  });
});

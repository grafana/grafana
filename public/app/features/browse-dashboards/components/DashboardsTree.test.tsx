import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProvider } from 'test/helpers/TestProvider';
import { assertIsDefined } from 'test/helpers/asserts';

import { selectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';

import {
  sharedWithMeFolder,
  wellFormedDashboard,
  wellFormedEmptyFolder,
  wellFormedFolder,
} from '../fixtures/dashboardsTreeItem.fixture';
import { SelectionState } from '../types';

import { DashboardsTree } from './DashboardsTree';

function render(...[ui, options]: Parameters<typeof rtlRender>) {
  rtlRender(<TestProvider>{ui}</TestProvider>, options);
}

describe('browse-dashboards DashboardsTree', () => {
  const WIDTH = 800;
  const HEIGHT = 600;
  const mockPermissions = {
    canEditFolders: true,
    canEditDashboards: true,
    canDeleteFolders: true,
    canDeleteDashboards: true,
  };

  const folder = wellFormedFolder(1);
  const emptyFolderIndicator = wellFormedEmptyFolder();
  const dashboard = wellFormedDashboard(2);
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
        onItemSelectionChange={noop}
        onAllSelectionChange={noop}
        isItemLoaded={allItemsAreLoaded}
        requestLoadMore={requestLoadMore}
      />
    );
    expect(screen.queryByText(dashboard.item.title)).toBeInTheDocument();
    expect(screen.queryByText(assertIsDefined(dashboard.item.tags)[0])).toBeInTheDocument();
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
        onItemSelectionChange={noop}
        onAllSelectionChange={noop}
        isItemLoaded={allItemsAreLoaded}
        requestLoadMore={requestLoadMore}
      />
    );

    expect(screen.queryByText(folder.item.title)).toBeInTheDocument();
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
    render(
      <DashboardsTree
        permissions={mockPermissions}
        items={[folder]}
        isSelected={isSelected}
        width={WIDTH}
        height={HEIGHT}
        onFolderClick={handler}
        onItemSelectionChange={noop}
        onAllSelectionChange={noop}
        isItemLoaded={allItemsAreLoaded}
        requestLoadMore={requestLoadMore}
      />
    );
    const folderButton = screen.getByLabelText(`Expand folder ${folder.item.title}`);
    await userEvent.click(folderButton);

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
        onItemSelectionChange={noop}
        onAllSelectionChange={noop}
        isItemLoaded={allItemsAreLoaded}
        requestLoadMore={requestLoadMore}
      />
    );
    expect(screen.queryByText('No items')).toBeInTheDocument();
  });
});

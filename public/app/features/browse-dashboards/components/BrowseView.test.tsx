import { act, getByLabelText, render, screen, userEvent } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { locationService, setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { getFolderFixtures, setTestFlags } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import * as useFolderDocsModule from 'app/features/provisioning/hooks/useFolderDocs';
import * as useFolderReadmeModule from 'app/features/provisioning/hooks/useFolderReadme';
import { type DashboardViewItem } from 'app/features/search/types';
import { AccessControlAction } from 'app/types/accessControl';

import { fullyLoadedViewItemCollection } from '../fixtures/state.fixtures';

import { BrowseView } from './BrowseView';

const [
  mockTree,
  { folderA, folderA_folderA, folderA_folderB, folderA_folderB_dashbdB, dashbdD, folderB_empty, folderC },
] = getFolderFixtures();

setBackendSrv(backendSrv);
setupMockServer();

describe('browse-dashboards BrowseView', () => {
  const WIDTH = 800;
  const HEIGHT = 600;
  const mockPermissions = {
    canEditFolders: true,
    canEditDashboards: true,
    canDeleteFolders: true,
    canDeleteDashboards: true,
  };

  beforeEach(() => {
    jest.spyOn(contextSrv, 'hasPermission').mockImplementation((permission: string) => {
      if (permission === AccessControlAction.FoldersRead) {
        return true;
      }
      return false;
    });
  });

  it('expands and collapses a folder', async () => {
    render(<BrowseView permissions={mockPermissions} folderUID={undefined} width={WIDTH} height={HEIGHT} />);
    await screen.findByText(folderA.item.title);

    await expandFolder(folderA.item);
    expect(screen.getByText(folderA_folderA.item.title)).toBeInTheDocument();

    await collapseFolder(folderA.item);
    expect(screen.queryByText(folderA_folderA.item.title)).not.toBeInTheDocument();
  });

  it('checks items when selected', async () => {
    render(<BrowseView permissions={mockPermissions} folderUID={undefined} width={WIDTH} height={HEIGHT} />);

    const checkbox = await screen.findByTestId(selectors.pages.BrowseDashboards.table.checkbox(dashbdD.item.uid));
    expect(checkbox).not.toBeChecked();

    await userEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it('checks all descendants when a folder is selected', async () => {
    render(<BrowseView permissions={mockPermissions} folderUID={undefined} width={WIDTH} height={HEIGHT} />);
    await screen.findByText(folderA.item.title);

    // First expand then click folderA
    await expandFolder(folderA.item);
    await clickCheckbox(folderA.item);

    // All the visible items in it should be checked now
    const directChildren = mockTree.filter((v) => v.item.kind !== 'ui' && v.item.parentUID === folderA.item.uid);

    for (const child of directChildren) {
      const childCheckbox = screen.queryByTestId(selectors.pages.BrowseDashboards.table.checkbox(child.item.uid));
      expect(childCheckbox).toBeChecked();
    }
  });

  it('checks descendants loaded after a folder is selected', async () => {
    render(<BrowseView permissions={mockPermissions} folderUID={undefined} width={WIDTH} height={HEIGHT} />);
    await screen.findByText(folderA.item.title);

    // First expand then click folderA
    await expandFolder(folderA.item);
    await clickCheckbox(folderA.item);

    // When additional children are loaded (by expanding a folder), those items
    // should also be selected
    await expandFolder(folderA_folderB.item);

    const grandchildren = mockTree.filter((v) => v.item.kind !== 'ui' && v.item.parentUID === folderA_folderB.item.uid);

    for (const child of grandchildren) {
      const childCheckbox = screen.queryByTestId(selectors.pages.BrowseDashboards.table.checkbox(child.item.uid));
      expect(childCheckbox).toBeChecked();
    }
  });

  it('unchecks ancestors when unselecting an item', async () => {
    render(<BrowseView permissions={mockPermissions} folderUID={undefined} width={WIDTH} height={HEIGHT} />);
    await screen.findByText(folderA.item.title);

    await expandFolder(folderA.item);
    await expandFolder(folderA_folderB.item);

    await clickCheckbox(folderA.item);
    await clickCheckbox(folderA_folderB_dashbdB.item);

    const itemCheckbox = screen.queryByTestId(
      selectors.pages.BrowseDashboards.table.checkbox(folderA_folderB_dashbdB.item.uid)
    );
    expect(itemCheckbox).not.toBeChecked();

    const parentCheckbox = screen.queryByTestId(
      selectors.pages.BrowseDashboards.table.checkbox(folderA_folderB.item.uid)
    );
    expect(parentCheckbox).not.toBeChecked();

    const grandparentCheckbox = screen.queryByTestId(selectors.pages.BrowseDashboards.table.checkbox(folderA.item.uid));
    expect(grandparentCheckbox).not.toBeChecked();
  });

  it('shows indeterminate checkboxes when a descendant is selected', async () => {
    render(<BrowseView permissions={mockPermissions} folderUID={undefined} width={WIDTH} height={HEIGHT} />);
    await screen.findByText(folderA.item.title);

    await expandFolder(folderA.item);
    await expandFolder(folderA_folderB.item);

    await clickCheckbox(folderA_folderB_dashbdB.item);

    const parentCheckbox = screen.queryByTestId(
      selectors.pages.BrowseDashboards.table.checkbox(folderA_folderB.item.uid)
    );
    expect(parentCheckbox).not.toBeChecked();
    expect(parentCheckbox).toBePartiallyChecked();

    const grandparentCheckbox = screen.queryByTestId(selectors.pages.BrowseDashboards.table.checkbox(folderA.item.uid));
    expect(grandparentCheckbox).not.toBeChecked();
    expect(grandparentCheckbox).toBePartiallyChecked();
  });

  it('renders a dashboard whose UID matches its parent folder', async () => {
    // Unified storage namespaces UIDs per kind, so a dashboard may share its parent folder's UID
    const folder: DashboardViewItem = { kind: 'folder', uid: 'same-uid', title: 'Folder same-uid' };
    const dashboard: DashboardViewItem = {
      kind: 'dashboard',
      uid: 'same-uid',
      title: 'Dashboard same-uid',
      parentUID: 'same-uid',
    };

    render(<BrowseView permissions={mockPermissions} folderUID={undefined} width={WIDTH} height={HEIGHT} />, {
      preloadedState: {
        browseDashboards: {
          rootItems: fullyLoadedViewItemCollection([folder]),
          childrenByParentUID: { 'same-uid': fullyLoadedViewItemCollection([dashboard]) },
          openFolders: { 'same-uid': true },
          selectedItems: { $all: false, dashboard: {}, folder: {}, panel: {} },
        },
      },
    });

    // Rendering each row's checkbox calls isSelected, which walks hasSelectedDescendants; the dashboard row must be a
    // leaf even though childrenByParentUID has an entry under its UID. Each row is labelled by its own title.
    expect(await screen.findByRole('row', { name: folder.title })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: dashboard.title })).toBeInTheDocument();
  });

  describe('when there is no item in the folder', () => {
    it('shows a CTA for creating a dashboard if the user has editor rights', async () => {
      render(
        <BrowseView permissions={mockPermissions} folderUID={folderB_empty.item.uid} width={WIDTH} height={HEIGHT} />
      );
      expect(await screen.findByText('Create dashboard')).toBeInTheDocument();
    });

    it('shows a simple message if the user has viewer rights', async () => {
      const mockPermissionsDisabled = {
        canEditFolders: false,
        canEditDashboards: false,
        canDeleteFolders: false,
        canDeleteDashboards: false,
      };

      render(
        <BrowseView
          permissions={mockPermissionsDisabled}
          folderUID={folderB_empty.item.uid}
          width={WIDTH}
          height={HEIGHT}
        />
      );
      expect(await screen.findByText('This folder is empty')).toBeInTheDocument();
    });
  });

  describe('inline README row', () => {
    const mockRepository = {
      name: 'r',
      target: 'folder',
      title: 'r',
      type: 'github',
      url: 'https://github.com/o/r',
      branch: 'main',
      workflows: [],
    } as never;

    const readmeDoc = { key: 'readme' as const, path: 'README.md', fileName: 'README.md' };

    // useFolderDocs always lists a README tab first, synthesized when the file is absent.
    function mockDocs(docs: useFolderDocsModule.UseFolderDocsResult['docs'] = [readmeDoc]) {
      jest.spyOn(useFolderDocsModule, 'useFolderDocs').mockReturnValue({
        repository: mockRepository,
        folder: undefined,
        docs,
        isLoading: false,
      });
    }

    function mockReadme(markdownContent = '# README\n\nbody') {
      mockDocs();
      jest.spyOn(useFolderReadmeModule, 'useFolderReadme').mockReturnValue({
        status: 'ok',
        markdownContent,
        refetch: jest.fn(),
        syncFinished: undefined,
      });
    }

    function mockReadmeMissing() {
      mockDocs();
      jest.spyOn(useFolderReadmeModule, 'useFolderReadme').mockReturnValue({
        status: 'missing',
        markdownContent: undefined,
        refetch: jest.fn(),
        syncFinished: undefined,
      });
    }

    afterEach(() => {
      act(() => {
        setTestFlags({});
      });
      jest.restoreAllMocks();
    });

    it('appends the README panel as the last row when the folder is provisioned and has children', async () => {
      setTestFlags({ 'provisioning.readmes': true });
      mockReadme();

      render(
        <BrowseView
          permissions={mockPermissions}
          folderUID={folderA.item.uid}
          isProvisionedFolder
          width={WIDTH}
          height={HEIGHT}
        />
      );

      expect(await screen.findByRole('tab', { name: 'README' })).toBeInTheDocument();
    });

    it('does not append the README row when the toggle is off', async () => {
      setTestFlags({ 'provisioning.readmes': false });
      mockReadme();

      render(
        <BrowseView
          permissions={mockPermissions}
          folderUID={folderA.item.uid}
          isProvisionedFolder
          width={WIDTH}
          height={HEIGHT}
        />
      );
      await screen.findByText(folderA_folderA.item.title);

      expect(screen.queryByRole('tab', { name: 'README' })).not.toBeInTheDocument();
    });

    it('does not append the README row when the folder is not provisioned', async () => {
      setTestFlags({ 'provisioning.readmes': true });
      mockReadme();

      render(<BrowseView permissions={mockPermissions} folderUID={folderA.item.uid} width={WIDTH} height={HEIGHT} />);
      await screen.findByText(folderA_folderA.item.title);

      expect(screen.queryByRole('tab', { name: 'README' })).not.toBeInTheDocument();
    });

    it('does not append the README row when there is no folderUID (root)', async () => {
      setTestFlags({ 'provisioning.readmes': true });
      mockReadme();

      render(
        <BrowseView
          permissions={mockPermissions}
          folderUID={undefined}
          isProvisionedFolder
          width={WIDTH}
          height={HEIGHT}
        />
      );
      await screen.findByText(folderA.item.title);

      expect(screen.queryByRole('tab', { name: 'README' })).not.toBeInTheDocument();
    });

    it('appends the README panel for empty provisioned folders', async () => {
      setTestFlags({ 'provisioning.readmes': true });
      mockReadme();

      render(
        <BrowseView
          permissions={mockPermissions}
          folderUID={folderB_empty.item.uid}
          isProvisionedFolder
          width={WIDTH}
          height={HEIGHT}
        />
      );

      expect(await screen.findByText('Create dashboard')).toBeInTheDocument();
      expect(await screen.findByRole('tab', { name: 'README' })).toBeInTheDocument();
    });

    it('shows the Add README CTA for empty provisioned folders without a README', async () => {
      setTestFlags({ 'provisioning.readmes': true });
      mockReadmeMissing();

      render(
        <BrowseView
          permissions={mockPermissions}
          folderUID={folderB_empty.item.uid}
          isProvisionedFolder
          width={WIDTH}
          height={HEIGHT}
        />
      );

      expect(await screen.findByText('Create dashboard')).toBeInTheDocument();
      expect(await screen.findByRole('link', { name: /Add README/i })).toBeInTheDocument();
    });

    it('keeps a ?docTab= deep link when navigating from one folder to another', async () => {
      setTestFlags({ 'provisioning.readmes': true });
      mockDocs([readmeDoc, { key: 'security', path: 'SECURITY.md', fileName: 'SECURITY.md' }]);
      const readmeSpy = jest.spyOn(useFolderReadmeModule, 'useFolderReadme').mockReturnValue({
        status: 'ok',
        markdownContent: '# README',
        refetch: jest.fn(),
        syncFinished: undefined,
      });

      // Two empty folders, so the panel is mounted at the same spot before and after.
      const { rerender } = render(
        <BrowseView
          permissions={mockPermissions}
          folderUID={folderB_empty.item.uid}
          isProvisionedFolder
          width={WIDTH}
          height={HEIGHT}
        />
      );
      expect(await screen.findByRole('tab', { name: 'README' })).toHaveAttribute('aria-selected', 'true');

      // A markdown link to another folder's doc lands on that folder with the tab in the URL.
      act(() => locationService.push(`/dashboards/f/${folderC.item.uid}?docTab=SECURITY.md`));
      rerender(
        <BrowseView
          permissions={mockPermissions}
          folderUID={folderC.item.uid}
          isProvisionedFolder
          width={WIDTH}
          height={HEIGHT}
        />
      );

      expect(await screen.findByRole('tab', { name: 'Security' })).toHaveAttribute('aria-selected', 'true');
      expect(readmeSpy).toHaveBeenLastCalledWith('r', 'SECURITY.md');
    });
  });
});

async function expandFolder(item: DashboardViewItem) {
  const row = screen.getByTestId(selectors.pages.BrowseDashboards.table.row(item.title));
  const expandButton = getByLabelText(row, /Expand folder/);
  await userEvent.click(expandButton);
}

async function collapseFolder(item: DashboardViewItem) {
  const row = screen.getByTestId(selectors.pages.BrowseDashboards.table.row(item.title));
  const expandButton = getByLabelText(row, /Collapse folder/);
  await userEvent.click(expandButton);
}

async function clickCheckbox(item: DashboardViewItem) {
  const checkbox = screen.getByTestId(selectors.pages.BrowseDashboards.table.checkbox(item.uid));
  await userEvent.click(checkbox);
}

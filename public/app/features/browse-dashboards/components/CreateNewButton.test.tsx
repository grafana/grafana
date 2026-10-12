import { screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { render } from 'test/test-utils';

import { type DataSourceInstanceListItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';
import { useDataSourceInstanceList } from '@grafana/runtime/unstable';
import { PROVISIONING_API_BASE as PROVISIONING_BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { contextSrv } from 'app/core/services/context_srv';
import { ManagerKind } from 'app/features/apiserver/types';
import { getDashboardTemplatesTab } from 'app/features/dashboard/dashgrid/DashboardLibrary/enterprise-components/DashboardTemplatesTabExtension';
import { setupProvisioningMswServer } from 'app/features/provisioning/mocks/server';
import { AccessControlAction } from 'app/types/accessControl';
import { type FolderDTO } from 'app/types/folders';

import { mockFolderDTO } from '../fixtures/folder.fixture';

import CreateNewButton from './CreateNewButton';

setupProvisioningMswServer();

jest.mock(
  'app/features/dashboard/dashgrid/DashboardLibrary/enterprise-components/DashboardTemplatesTabExtension',
  () => ({
    getDashboardTemplatesTab: jest.fn(() => null),
  })
);

const mockGetDashboardTemplatesTab = jest.mocked(getDashboardTemplatesTab);

const defaultTestDataSource = {
  name: 'Test Data Source',
  uid: 'test-data-source-uid',
  type: 'grafana-testdata-datasource',
} as DataSourceInstanceListItem;

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  useDataSourceInstanceList: jest.fn(() => ({ isLoading: false, items: [] })),
}));

const mockUseDataSourceInstanceList = jest.mocked(useDataSourceInstanceList);

const mockParentFolder = mockFolderDTO();

async function renderAndOpen(folder?: FolderDTO) {
  const { user } = render(
    <CreateNewButton canCreateDashboard canCreateFolder parentFolder={folder} isReadOnlyRepo={false} />
  );
  const newButton = screen.getByText('New');
  await user.click(newButton);
}

describe('NewActionsButton', () => {
  it('should display the correct urls with a given parent folder', async () => {
    await renderAndOpen(mockParentFolder);

    expect(screen.getByRole('menuitem', { name: 'New dashboard' })).toHaveAttribute(
      'href',
      `/dashboard/new?folderUid=${mockParentFolder.uid}`
    );
    expect(screen.getByRole('menuitem', { name: 'Import dashboard' })).toHaveAttribute(
      'href',
      `/dashboard/import?folderUid=${mockParentFolder.uid}`
    );
  });

  it('should display urls without params when there is no parent folder', async () => {
    await renderAndOpen();

    expect(screen.getByRole('menuitem', { name: 'New dashboard' })).toHaveAttribute('href', '/dashboard/new');
    expect(screen.getByRole('menuitem', { name: 'Import dashboard' })).toHaveAttribute('href', '/dashboard/import');
  });

  it('clicking the "New folder" button opens the drawer', async () => {
    const { user } = render(
      <CreateNewButton canCreateDashboard canCreateFolder parentFolder={mockParentFolder} isReadOnlyRepo={false} />
    );

    const newButton = screen.getByText('New');
    await user.click(newButton);
    await user.click(screen.getByRole('menuitem', { name: 'New folder' }));

    const drawer = screen.getByRole('dialog', { name: 'New folder' });
    expect(drawer).toBeInTheDocument();
    expect(within(drawer).getByRole('heading', { name: 'New folder' })).toBeInTheDocument();
    expect(within(drawer).getByText(`Location: ${mockParentFolder.title}`)).toBeInTheDocument();
  });

  it('renders dashboard items under a Dashboard group', async () => {
    await renderAndOpen();

    const dashboardGroup = screen.getByRole('group', { name: 'Dashboard' });
    expect(within(dashboardGroup).getByRole('menuitem', { name: 'New dashboard' })).toBeInTheDocument();
    expect(within(dashboardGroup).getByRole('menuitem', { name: 'Import dashboard' })).toBeInTheDocument();
  });

  it('should only render dashboard items when folder creation is disabled', async () => {
    const { user } = render(<CreateNewButton canCreateDashboard canCreateFolder={false} isReadOnlyRepo={false} />);
    const newButton = screen.getByText('New');
    await user.click(newButton);

    expect(screen.getByRole('menuitem', { name: 'New dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Import dashboard' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'New folder' })).not.toBeInTheDocument();
  });

  it('should only render folder item when dashboard creation is disabled', async () => {
    const { user } = render(<CreateNewButton canCreateDashboard={false} canCreateFolder isReadOnlyRepo={false} />);
    const newButton = screen.getByText('New');
    await user.click(newButton);

    expect(screen.queryByRole('menuitem', { name: 'New dashboard' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Import dashboard' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'New folder' })).toBeInTheDocument();
  });

  it('should show Import dashboard button when folder is provisioned', async () => {
    const provisionedFolder = mockFolderDTO(1, { managedBy: ManagerKind.Repo });
    await renderAndOpen(provisionedFolder);

    expect(screen.getByRole('menuitem', { name: 'New dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'New folder' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Import dashboard' })).toBeInTheDocument();
  });

  it('should show Import dashboard button when folder is not provisioned', async () => {
    const regularFolder = mockFolderDTO(1, { managedBy: undefined });
    await renderAndOpen(regularFolder);

    expect(screen.getByRole('menuitem', { name: 'New dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'New folder' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Import dashboard' })).toBeInTheDocument();
  });

  describe('creating a folder with Git Sync configured', () => {
    let originalProvisioning: boolean;

    beforeEach(() => {
      originalProvisioning = config.provisioningEnabled;
      config.provisioningEnabled = true;
      server.use(
        http.get(`${PROVISIONING_BASE}/settings`, () =>
          HttpResponse.json({
            items: [
              {
                name: 'folderless-repo',
                title: 'Folderless Repo',
                type: 'github',
                target: 'folderless',
                workflows: ['write', 'branch'],
              } satisfies RepositoryView,
            ],
          })
        )
      );
    });

    afterEach(() => {
      config.provisioningEnabled = originalProvisioning;
    });

    // The drawer body owns the Git/database choice, so every close path has to drop it. Held here it
    // would survive, and the next open would skip the choice.
    it('forgets the choice when the drawer is closed and reopened', async () => {
      const { user } = render(<CreateNewButton canCreateDashboard canCreateFolder isReadOnlyRepo={false} />);
      await user.click(screen.getByText('New'));
      await user.click(screen.getByRole('menuitem', { name: 'New folder' }));

      /** The Git form is the only one of the two with a commit comment field. */
      const findGitForm = () => screen.findByRole('textbox', { name: /comment/i });
      const queryDatabaseForm = () => screen.queryByTestId(selectors.pages.BrowseDashboards.NewFolderForm.form);

      await findGitForm();
      await user.click(screen.getByRole('button', { name: 'Create in Grafana database instead' }));
      expect(queryDatabaseForm()).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      await user.click(screen.getByText('New'));
      await user.click(screen.getByRole('menuitem', { name: 'New folder' }));

      expect(await findGitForm()).toBeInTheDocument();
      expect(queryDatabaseForm()).not.toBeInTheDocument();
    });
  });

  describe('Dashboard from template button', () => {
    let originalPermissions: typeof contextSrv.user.permissions;

    beforeEach(() => {
      config.featureToggles.dashboardTemplates = true;
      // Reset to defaults: a test datasource is available, custom templates are off.
      mockUseDataSourceInstanceList.mockReturnValue({ isLoading: false, items: [defaultTestDataSource] });
      mockGetDashboardTemplatesTab.mockReturnValue(null);
      setTestFlags({ 'grafana.customDashboardTemplates': false });
      // Custom templates require dashboardtemplates:read; grant it by default (grafana-provisioned
      // templates don't depend on it).
      originalPermissions = contextSrv.user.permissions;
      contextSrv.user.permissions = { [AccessControlAction.DashboardTemplatesRead]: true };
    });

    afterEach(() => {
      contextSrv.user.permissions = originalPermissions;
    });

    it('should show a `Use template` button when the feature flag is enabled', async () => {
      await renderAndOpen();
      expect(screen.getByRole('menuitem', { name: 'Use template' })).toBeInTheDocument();
    });

    it('should not show a `Use template` button when neither templates feature is enabled', async () => {
      config.featureToggles.dashboardTemplates = false;
      mockUseDataSourceInstanceList.mockReturnValue({ isLoading: false, items: [] });
      await renderAndOpen();
      expect(screen.queryByRole('menuitem', { name: 'Use template' })).not.toBeInTheDocument();
    });

    it('should show a `Use template` button when only custom templates are enabled, even without a test datasource', async () => {
      config.featureToggles.dashboardTemplates = false;
      mockUseDataSourceInstanceList.mockReturnValue({ isLoading: false, items: [] });
      mockGetDashboardTemplatesTab.mockReturnValue(() => null);
      setTestFlags({ 'grafana.customDashboardTemplates': true });

      await renderAndOpen();
      expect(screen.getByRole('menuitem', { name: 'Use template' })).toBeInTheDocument();
    });

    it('should redirect the user to the dashboard from template page when the button is clicked', async () => {
      await renderAndOpen();
      const link = screen.getByRole('menuitem', { name: 'Use template' });
      expect(link).toHaveAttribute('href', '/dashboards?templateDashboards=true&source=createNewButton');
    });
  });
});

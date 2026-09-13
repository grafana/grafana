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
import { useDashboardGenerationAvailable } from 'app/features/dashboard-prompt/useDashboardGenerationAvailable';
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

jest.mock('app/features/dashboard-prompt/useDashboardGenerationAvailable', () => ({
  useDashboardGenerationAvailable: jest.fn(),
}));

// Stub the lazy-loaded modal: this suite covers the menu wiring, not the prompt itself.
jest.mock('app/features/dashboard-prompt/GenerateDashboardModal', () => ({
  GenerateDashboardModal: ({ onDismiss }: { onDismiss: () => void }) => (
    <div data-testid="generate-dashboard-modal">
      <button onClick={onDismiss}>Close prompt</button>
    </div>
  ),
}));

const mockUseDataSourceInstanceList = jest.mocked(useDataSourceInstanceList);
const mockUseDashboardGenerationAvailable = jest.mocked(useDashboardGenerationAvailable);

const mockParentFolder = mockFolderDTO();

async function renderAndOpen(folder?: FolderDTO) {
  const { user } = render(
    <CreateNewButton canCreateDashboard canCreateFolder parentFolder={folder} isReadOnlyRepo={false} />
  );
  const newButton = screen.getByText('New');
  await user.click(newButton);
}

describe('NewActionsButton', () => {
  beforeEach(() => {
    mockUseDashboardGenerationAvailable.mockReturnValue(false);
  });
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
    });

    afterEach(() => {
      config.provisioningEnabled = originalProvisioning;
    });

    const FOLDERLESS_REPO: RepositoryView = {
      name: 'folderless-repo',
      title: 'Folderless Repo',
      type: 'github',
      target: 'folderless',
      workflows: ['write', 'branch'],
    };

    function mockRepositories(items: RepositoryView[], settle?: () => Promise<unknown>) {
      server.use(
        http.get(`${PROVISIONING_BASE}/settings`, async () => {
          await settle?.();
          return HttpResponse.json({ items });
        })
      );
    }

    async function openNewFolderDrawer(parentFolder?: FolderDTO) {
      const { user } = render(
        <CreateNewButton canCreateDashboard canCreateFolder parentFolder={parentFolder} isReadOnlyRepo={false} />
      );
      await user.click(screen.getByText('New'));
      await user.click(screen.getByRole('menuitem', { name: 'New folder' }));
      return user;
    }

    /** The Git form is the only one of the two with a commit comment field. */
    const findGitForm = () => screen.findByRole('textbox', { name: /comment/i });
    const queryGitForm = () => screen.queryByRole('textbox', { name: /comment/i });
    const queryDatabaseForm = () => screen.queryByTestId(selectors.pages.BrowseDashboards.NewFolderForm.form);

    it('creates through a folderless repository at the root, with the database offered as an alternative', async () => {
      mockRepositories([FOLDERLESS_REPO]);

      await openNewFolderDrawer();

      expect(await findGitForm()).toBeInTheDocument();
      expect(queryDatabaseForm()).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create in Grafana database instead' })).toBeInTheDocument();
    });

    it('switches between the repository and the database, and back', async () => {
      mockRepositories([FOLDERLESS_REPO]);

      const user = await openNewFolderDrawer();
      await findGitForm();

      await user.click(screen.getByRole('button', { name: 'Create in Grafana database instead' }));
      expect(queryDatabaseForm()).toBeInTheDocument();
      expect(queryGitForm()).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Create in Git repository instead' }));
      expect(await findGitForm()).toBeInTheDocument();
      expect(queryDatabaseForm()).not.toBeInTheDocument();
    });

    it('forgets the choice when the drawer is closed and reopened', async () => {
      mockRepositories([FOLDERLESS_REPO]);

      const user = await openNewFolderDrawer();
      await findGitForm();
      await user.click(screen.getByRole('button', { name: 'Create in Grafana database instead' }));
      expect(queryDatabaseForm()).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      await user.click(screen.getByText('New'));
      await user.click(screen.getByRole('menuitem', { name: 'New folder' }));

      expect(await findGitForm()).toBeInTheDocument();
      expect(queryDatabaseForm()).not.toBeInTheDocument();
    });

    it('waits for the lookup instead of flashing the database form', async () => {
      let releaseSettings = () => {};
      mockRepositories([FOLDERLESS_REPO], () => new Promise<void>((resolve) => (releaseSettings = resolve)));

      await openNewFolderDrawer();

      expect(screen.getByTestId('Spinner')).toBeInTheDocument();
      expect(queryDatabaseForm()).not.toBeInTheDocument();
      expect(queryGitForm()).not.toBeInTheDocument();

      releaseSettings();
      expect(await findGitForm()).toBeInTheDocument();
    });

    it('creates in the database at the root when no repository is configured', async () => {
      mockRepositories([]);

      await openNewFolderDrawer();

      expect(await screen.findByTestId(selectors.pages.BrowseDashboards.NewFolderForm.form)).toBeInTheDocument();
      expect(queryGitForm()).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Create in Grafana database instead' })).not.toBeInTheDocument();
    });

    it('does not offer a folderless repository inside an unmanaged folder', async () => {
      mockRepositories([FOLDERLESS_REPO]);

      await openNewFolderDrawer(mockFolderDTO(1, { managedBy: undefined }));

      expect(await screen.findByTestId(selectors.pages.BrowseDashboards.NewFolderForm.form)).toBeInTheDocument();
      expect(queryGitForm()).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Create in Grafana database instead' })).not.toBeInTheDocument();
    });

    it('leaves the database reachable when the folderless repository is read only', async () => {
      mockRepositories([{ ...FOLDERLESS_REPO, workflows: [] }]);

      const user = await openNewFolderDrawer();

      // The Git form dead-ends on a read-only repository, so the switch must stay outside it
      const toDatabase = await screen.findByRole('button', { name: 'Create in Grafana database instead' });
      expect(screen.getByText(/this repository is read only/i)).toBeInTheDocument();

      await user.click(toDatabase);
      expect(queryDatabaseForm()).toBeInTheDocument();
    });

    it('shows the lookup failure instead of silently offering only the database', async () => {
      server.use(
        http.get(`${PROVISIONING_BASE}/settings`, () => HttpResponse.json({ message: 'boom' }, { status: 500 }))
      );

      await openNewFolderDrawer();

      expect(await screen.findByText('Error loading form')).toBeInTheDocument();
      expect(queryDatabaseForm()).toBeInTheDocument();
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

  describe('Generate dashboard item', () => {
    beforeEach(() => {
      mockUseDashboardGenerationAvailable.mockReturnValue(true);
    });

    it('shows the item directly after `New dashboard`, matching the QuickAdd menu', async () => {
      await renderAndOpen();

      const dashboardGroup = screen.getByRole('group', { name: 'Dashboard' });
      const items = within(dashboardGroup)
        .getAllByRole('menuitem')
        .map((item) => item.textContent);
      expect(items.slice(0, 2)).toEqual(['New dashboard', 'Generate dashboard']);
    });

    it('opens the prompt on click, and closes it again on dismiss', async () => {
      const { user } = render(<CreateNewButton canCreateDashboard canCreateFolder isReadOnlyRepo={false} />);
      await user.click(screen.getByText('New'));
      expect(screen.queryByTestId('generate-dashboard-modal')).not.toBeInTheDocument();

      await user.click(screen.getByRole('menuitem', { name: 'Generate dashboard' }));
      expect(await screen.findByTestId('generate-dashboard-modal')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Close prompt' }));
      expect(screen.queryByTestId('generate-dashboard-modal')).not.toBeInTheDocument();
    });

    it('does not show the item when generation is unavailable', async () => {
      mockUseDashboardGenerationAvailable.mockReturnValue(false);
      await renderAndOpen();
      expect(screen.queryByRole('menuitem', { name: 'Generate dashboard' })).not.toBeInTheDocument();
    });

    it('does not show the item when the user cannot create dashboards', async () => {
      const { user } = render(<CreateNewButton canCreateDashboard={false} canCreateFolder isReadOnlyRepo={false} />);
      await user.click(screen.getByText('New'));
      expect(screen.queryByRole('menuitem', { name: 'Generate dashboard' })).not.toBeInTheDocument();
    });
  });
});

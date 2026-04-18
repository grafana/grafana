import { screen, within } from '@testing-library/react';
import { render } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { ManagerKind } from 'app/features/apiserver/types';
import { useIsProvisionedInstance } from 'app/features/provisioning/hooks/useIsProvisionedInstance';
import { type FolderDTO } from 'app/types/folders';

import { mockFolderDTO } from '../fixtures/folder.fixture';

import CreateNewButton from './CreateNewButton';

jest.mock('app/features/provisioning/hooks/useIsProvisionedInstance', () => ({
  useIsProvisionedInstance: jest.fn(),
}));

jest.mock('@grafana/runtime', () => {
  return {
    ...jest.requireActual('@grafana/runtime'),
    getDataSourceSrv: () => ({
      getList: jest
        .fn()
        .mockReturnValue([
          { name: 'Test Data Source', uid: 'test-data-source-uid', type: 'grafana-testdata-datasource' },
        ]),
    }),
  };
});

const mockUseIsProvisionedInstance = useIsProvisionedInstance as jest.MockedFunction<typeof useIsProvisionedInstance>;

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
    mockUseIsProvisionedInstance.mockReturnValue(false);
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

  it('should hide Import button when folder is provisioned', async () => {
    const provisionedFolder = mockFolderDTO(1, { managedBy: ManagerKind.Repo });
    await renderAndOpen(provisionedFolder);

    expect(screen.getByRole('menuitem', { name: 'New dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'New folder' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Import dashboard' })).not.toBeInTheDocument();
  });

  it('should show Import dashboard button when folder is not provisioned', async () => {
    const regularFolder = mockFolderDTO(1, { managedBy: undefined });
    await renderAndOpen(regularFolder);

    expect(screen.getByRole('menuitem', { name: 'New dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'New folder' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Import dashboard' })).toBeInTheDocument();
  });

  it('should hide Import dashboard button when entire instance is provisioned', async () => {
    mockUseIsProvisionedInstance.mockReturnValue(true);
    const regularFolder = mockFolderDTO(1, { managedBy: undefined });
    await renderAndOpen(regularFolder);

    expect(screen.getByRole('menuitem', { name: 'New dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'New folder' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Import dashboard' })).not.toBeInTheDocument();
  });

  it('should hide Import dashboard button when both instance and folder are provisioned', async () => {
    mockUseIsProvisionedInstance.mockReturnValue(true);
    const provisionedFolder = mockFolderDTO(1, { managedBy: ManagerKind.Repo });
    await renderAndOpen(provisionedFolder);

    expect(screen.getByRole('menuitem', { name: 'New dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'New folder' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Import dashboard' })).not.toBeInTheDocument();
  });

  describe('Dashboard from template button', () => {
    beforeEach(() => {
      config.featureToggles.dashboardTemplates = true;
    });

    it('should show a `Use template` button when the feature flag is enabled', async () => {
      await renderAndOpen();
      expect(screen.getByRole('menuitem', { name: 'Use template' })).toBeInTheDocument();
    });

    it('should not show a `Use template` button when the feature flag is disabled', async () => {
      config.featureToggles.dashboardTemplates = false;
      await renderAndOpen();
      expect(screen.queryByRole('menuitem', { name: 'Use template' })).not.toBeInTheDocument();
    });

    it('should redirect the user to the dashboard from template page when the button is clicked', async () => {
      await renderAndOpen();
      const link = screen.getByRole('menuitem', { name: 'Use template' });
      expect(link).toHaveAttribute('href', '/dashboards?templateDashboards=true&source=createNewButton');
    });
  });
});

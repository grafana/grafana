import { screen, within } from '@testing-library/react';
import { render } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { ManagerKind } from 'app/features/apiserver/types';
import { useIsProvisionedInstance } from 'app/features/provisioning/hooks/useIsProvisionedInstance';
import { FolderDTO } from 'app/types/folders';

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

    expect(screen.getByRole('link', { name: 'New dashboard' })).toHaveAttribute(
      'href',
      `/dashboard/new?folderUid=${mockParentFolder.uid}`
    );
    expect(screen.getByRole('link', { name: 'Import' })).toHaveAttribute(
      'href',
      `/dashboard/import?folderUid=${mockParentFolder.uid}`
    );
  });

  it('should display urls without params when there is no parent folder', async () => {
    await renderAndOpen();

    expect(screen.getByRole('link', { name: 'New dashboard' })).toHaveAttribute('href', '/dashboard/new');
    expect(screen.getByRole('link', { name: 'Import' })).toHaveAttribute('href', '/dashboard/import');
  });

  it('clicking the "New folder" button opens the drawer', async () => {
    const { user } = render(
      <CreateNewButton canCreateDashboard canCreateFolder parentFolder={mockParentFolder} isReadOnlyRepo={false} />
    );

    const newButton = screen.getByText('New');
    await user.click(newButton);
    await user.click(screen.getByText('New folder'));

    const drawer = screen.getByRole('dialog', { name: 'New folder' });
    expect(drawer).toBeInTheDocument();
    expect(within(drawer).getByRole('heading', { name: 'New folder' })).toBeInTheDocument();
    expect(within(drawer).getByText(`Location: ${mockParentFolder.title}`)).toBeInTheDocument();
  });

  it('should only render dashboard items when folder creation is disabled', async () => {
    const { user } = render(<CreateNewButton canCreateDashboard canCreateFolder={false} isReadOnlyRepo={false} />);
    const newButton = screen.getByText('New');
    await user.click(newButton);

    expect(screen.getByRole('link', { name: 'New dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Import')).toBeInTheDocument();
    expect(screen.queryByText('New folder')).not.toBeInTheDocument();
  });

  it('should only render folder item when dashboard creation is disabled', async () => {
    const { user } = render(<CreateNewButton canCreateDashboard={false} canCreateFolder isReadOnlyRepo={false} />);
    const newButton = screen.getByText('New');
    await user.click(newButton);

    expect(screen.queryByText('New dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText('Import')).not.toBeInTheDocument();
    expect(screen.getByText('New folder')).toBeInTheDocument();
  });

  it('should hide Import button when folder is provisioned', async () => {
    const provisionedFolder = mockFolderDTO(1, { managedBy: ManagerKind.Repo });
    await renderAndOpen(provisionedFolder);

    expect(screen.getByRole('link', { name: 'New dashboard' })).toBeInTheDocument();
    expect(screen.getByText('New folder')).toBeInTheDocument();
    expect(screen.queryByText('Import')).not.toBeInTheDocument();
  });

  it('should show Import button when folder is not provisioned', async () => {
    const regularFolder = mockFolderDTO(1, { managedBy: undefined });
    await renderAndOpen(regularFolder);

    expect(screen.getByRole('link', { name: 'New dashboard' })).toBeInTheDocument();
    expect(screen.getByText('New folder')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Import' })).toBeInTheDocument();
  });

  it('should hide Import button when entire instance is provisioned', async () => {
    mockUseIsProvisionedInstance.mockReturnValue(true);
    const regularFolder = mockFolderDTO(1, { managedBy: undefined });
    await renderAndOpen(regularFolder);

    expect(screen.getByRole('link', { name: 'New dashboard' })).toBeInTheDocument();
    expect(screen.getByText('New folder')).toBeInTheDocument();
    expect(screen.queryByText('Import')).not.toBeInTheDocument();
  });

  it('should hide Import button when both instance and folder are provisioned', async () => {
    mockUseIsProvisionedInstance.mockReturnValue(true);
    const provisionedFolder = mockFolderDTO(1, { managedBy: ManagerKind.Repo });
    await renderAndOpen(provisionedFolder);

    expect(screen.getByRole('link', { name: 'New dashboard' })).toBeInTheDocument();
    expect(screen.getByText('New folder')).toBeInTheDocument();
    expect(screen.queryByText('Import')).not.toBeInTheDocument();
  });

  describe('Dashboard from template button', () => {
    beforeEach(() => {
      config.featureToggles.dashboardTemplates = true;
    });

    it('should show a `Dashboard from template` button when the feature flag is enabled', async () => {
      await renderAndOpen();
      expect(screen.getByRole('link', { name: 'Dashboard from template' })).toBeInTheDocument();
    });

    it('should not show a `Dashboard from template` button when the feature flag is disabled', async () => {
      config.featureToggles.dashboardTemplates = false;
      await renderAndOpen();
      expect(screen.queryByRole('link', { name: 'Dashboard from template' })).not.toBeInTheDocument();
    });

    it('should redirect the user to the dashboard from template page when the button is clicked', async () => {
      await renderAndOpen();
      const link = screen.getByRole('link', { name: 'Dashboard from template' });
      expect(link).toHaveAttribute('href', '/dashboards?templateDashboards=true&source=createNewButton');
    });
  });
});

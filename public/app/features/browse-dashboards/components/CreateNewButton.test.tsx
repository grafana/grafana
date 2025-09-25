import { render as rtlRender, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProvider } from 'test/helpers/TestProvider';

import { ManagerKind } from 'app/features/apiserver/types';
import { useIsProvisionedInstance } from 'app/features/provisioning/hooks/useIsProvisionedInstance';
import { FolderDTO } from 'app/types/folders';

import { mockFolderDTO } from '../fixtures/folder.fixture';

import CreateNewButton from './CreateNewButton';

jest.mock('app/features/provisioning/hooks/useIsProvisionedInstance', () => ({
  useIsProvisionedInstance: jest.fn(),
}));

const mockUseIsProvisionedInstance = useIsProvisionedInstance as jest.MockedFunction<typeof useIsProvisionedInstance>;

const mockParentFolder = mockFolderDTO();

function render(...[ui, options]: Parameters<typeof rtlRender>) {
  rtlRender(<TestProvider>{ui}</TestProvider>, options);
}

async function renderAndOpen(folder?: FolderDTO) {
  render(<CreateNewButton canCreateDashboard canCreateFolder parentFolder={folder} isReadOnlyRepo={false} />);
  const newButton = screen.getByText('New');
  await userEvent.click(newButton);
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
    render(
      <CreateNewButton canCreateDashboard canCreateFolder parentFolder={mockParentFolder} isReadOnlyRepo={false} />
    );

    const newButton = screen.getByText('New');
    await userEvent.click(newButton);
    await userEvent.click(screen.getByText('New folder'));

    const drawer = screen.getByRole('dialog', { name: 'Drawer title New folder' });
    expect(drawer).toBeInTheDocument();
    expect(within(drawer).getByRole('heading', { name: 'New folder' })).toBeInTheDocument();
    expect(within(drawer).getByText(`Location: ${mockParentFolder.title}`)).toBeInTheDocument();
  });

  it('should only render dashboard items when folder creation is disabled', async () => {
    render(<CreateNewButton canCreateDashboard canCreateFolder={false} isReadOnlyRepo={false} />);
    const newButton = screen.getByText('New');
    await userEvent.click(newButton);

    expect(screen.getByRole('link', { name: 'New dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Import')).toBeInTheDocument();
    expect(screen.queryByText('New folder')).not.toBeInTheDocument();
  });

  it('should only render folder item when dashboard creation is disabled', async () => {
    render(<CreateNewButton canCreateDashboard={false} canCreateFolder isReadOnlyRepo={false} />);
    const newButton = screen.getByText('New');
    await userEvent.click(newButton);

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
});

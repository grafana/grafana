import { render, screen, userEvent } from 'test/test-utils';

import { appEvents } from 'app/core/app_events';
import { ManagerKind } from 'app/features/apiserver/types';
import { ShowModalReactEvent } from 'app/types/events';

import { mockFolderDTO } from '../fixtures/folder.fixture';
import * as permissions from '../permissions';

import { DeleteModal } from './BrowseActions/DeleteModal';
import { MoveModal } from './BrowseActions/MoveModal';
import { FolderActionsButton } from './FolderActionsButton';

// Mock out the Permissions component for now
jest.mock('app/core/components/AccessControl/Permissions', () => ({
  Permissions: () => <div>Hello!</div>,
}));

const managePermissionsLabel = /Manage permissions/i;
const moveMenuItemLabel = /Move this folder/i;
const deleteMenuItemLabel = /Delete this folder/i;

describe('browse-dashboards FolderActionsButton', () => {
  const mockFolder = mockFolderDTO();
  const mockPermissions = {
    canCreateDashboards: true,
    canEditDashboards: true,
    canCreateFolders: true,
    canDeleteFolders: true,
    canEditFolders: true,
    canViewPermissions: true,
    canSetPermissions: true,
    canDeleteDashboards: true,
  };

  beforeEach(() => {
    jest.spyOn(permissions, 'getFolderPermissions').mockImplementation(() => mockPermissions);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not render anything when the user has no permissions to do anything', () => {
    jest.spyOn(permissions, 'getFolderPermissions').mockImplementation(() => {
      return {
        ...mockPermissions,
        canDeleteFolders: false,
        canEditFolders: false,
        canViewPermissions: false,
        canSetPermissions: false,
      };
    });
    render(<FolderActionsButton folder={mockFolder} />);
    expect(screen.queryByRole('button', { name: 'Folder actions' })).not.toBeInTheDocument();
  });

  it('renders a "Folder actions" button when the user has permissions to do something', () => {
    render(<FolderActionsButton folder={mockFolder} />);
    expect(screen.getByRole('button', { name: 'Folder actions' })).toBeInTheDocument();
  });

  it('renders all the options if the user has full permissions', async () => {
    const { user } = render(<FolderActionsButton folder={mockFolder} />);

    await user.click(screen.getByRole('button', { name: 'Folder actions' }));
    expect(screen.getByRole('menuitem', { name: managePermissionsLabel })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: moveMenuItemLabel })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: deleteMenuItemLabel })).toBeInTheDocument();
  });

  it('does not render the "Manage permissions" option if the user does not have permission to view permissions', async () => {
    jest.spyOn(permissions, 'getFolderPermissions').mockImplementation(() => {
      return {
        ...mockPermissions,
        canViewPermissions: false,
      };
    });
    render(<FolderActionsButton folder={mockFolder} />);

    await userEvent.click(screen.getByRole('button', { name: 'Folder actions' }));
    expect(screen.queryByRole('menuitem', { name: managePermissionsLabel })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: moveMenuItemLabel })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: deleteMenuItemLabel })).toBeInTheDocument();
  });

  it('does not render the "Move" option if the user does not have permission to edit', async () => {
    jest.spyOn(permissions, 'getFolderPermissions').mockImplementation(() => {
      return {
        ...mockPermissions,
        canEditFolders: false,
      };
    });
    render(<FolderActionsButton folder={mockFolder} />);

    await userEvent.click(screen.getByRole('button', { name: 'Folder actions' }));
    expect(screen.getByRole('menuitem', { name: managePermissionsLabel })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: moveMenuItemLabel })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: deleteMenuItemLabel })).toBeInTheDocument();
  });

  it('does not render the "Delete" option if the user does not have permission to delete', async () => {
    jest.spyOn(permissions, 'getFolderPermissions').mockImplementation(() => {
      return {
        ...mockPermissions,
        canDeleteFolders: false,
      };
    });
    render(<FolderActionsButton folder={mockFolder} />);

    await userEvent.click(screen.getByRole('button', { name: 'Folder actions' }));
    expect(screen.getByRole('menuitem', { name: managePermissionsLabel })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: moveMenuItemLabel })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: deleteMenuItemLabel })).not.toBeInTheDocument();
  });

  it('clicking the "Manage permissions" option opens the permissions drawer', async () => {
    render(<FolderActionsButton folder={mockFolder} />);

    await userEvent.click(screen.getByRole('button', { name: 'Folder actions' }));
    await userEvent.click(screen.getByRole('menuitem', { name: managePermissionsLabel }));
    expect(screen.getByRole('dialog', { name: 'Manage permissions' })).toBeInTheDocument();
  });

  it('clicking the "Move" option opens the move modal', async () => {
    jest.spyOn(appEvents, 'publish');
    render(<FolderActionsButton folder={mockFolder} />);

    await userEvent.click(screen.getByRole('button', { name: 'Folder actions' }));
    await userEvent.click(screen.getByRole('menuitem', { name: moveMenuItemLabel }));
    expect(appEvents.publish).toHaveBeenCalledWith(
      new ShowModalReactEvent(
        expect.objectContaining({
          component: MoveModal,
        })
      )
    );
  });

  it('clicking the "Delete" option opens the delete modal', async () => {
    jest.spyOn(appEvents, 'publish');
    render(<FolderActionsButton folder={mockFolder} />);

    await userEvent.click(screen.getByRole('button', { name: 'Folder actions' }));
    await userEvent.click(screen.getByRole('menuitem', { name: deleteMenuItemLabel }));
    expect(appEvents.publish).toHaveBeenCalledWith(
      new ShowModalReactEvent(
        expect.objectContaining({
          component: DeleteModal,
        })
      )
    );
  });

  // Git sync related tests
  it('does not render the "Manage permissions" option if folder is provisioned', async () => {
    jest.spyOn(permissions, 'getFolderPermissions').mockImplementation(() => {
      return {
        ...mockPermissions,
        canDeleteFolders: true, // provisioned folder can be deleted too (if not repo root)
      };
    });
    // passing parentUid to make it not a repo root folder
    render(<FolderActionsButton folder={{ ...mockFolder, managedBy: ManagerKind.Repo, parentUid: '123' }} />);

    await userEvent.click(screen.getByRole('button', { name: 'Folder actions' }));
    expect(screen.queryByRole('menuitem', { name: managePermissionsLabel })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: deleteMenuItemLabel })).toBeInTheDocument();
  });

  it('does not render any actions if folder is provisioned and is root repo folder', async () => {
    jest.spyOn(permissions, 'getFolderPermissions').mockImplementation(() => {
      return {
        ...mockPermissions,
      };
    });
    // passing undefined to parentUid to make it root repo folder
    render(<FolderActionsButton folder={{ ...mockFolder, managedBy: ManagerKind.Repo, parentUid: undefined }} />);

    expect(screen.queryByRole('button', { name: 'Folder actions' })).not.toBeInTheDocument();
  });

  it('does render the "Move" option if folder is provisioned and is NOT root repo folder', async () => {
    jest.spyOn(permissions, 'getFolderPermissions').mockImplementation(() => {
      return {
        ...mockPermissions,
        canViewPermissions: false,
      };
    });
    render(<FolderActionsButton folder={{ ...mockFolder, managedBy: ManagerKind.Repo, parentUid: '123' }} />);

    await userEvent.click(screen.getByRole('button', { name: 'Folder actions' }));
    expect(screen.getByRole('menuitem', { name: moveMenuItemLabel })).toBeInTheDocument();
  });

  it('does not render any actions when repo is read-only', () => {
    render(
      <FolderActionsButton folder={{ ...mockFolder, managedBy: ManagerKind.Repo, parentUid: '123' }} isReadOnlyRepo />
    );
    expect(screen.queryByRole('button', { name: 'Folder actions' })).not.toBeInTheDocument();
  });
});

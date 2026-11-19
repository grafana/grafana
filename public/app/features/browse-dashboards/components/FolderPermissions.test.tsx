import { render, screen } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { ManagerKind } from 'app/features/apiserver/types';
import { useFolderMetadataStatus } from 'app/features/provisioning/hooks/useFolderMetadataStatus';
import { AccessControlAction } from 'app/types/accessControl';

import { mockFolderDTO } from '../fixtures/folder.fixture';

import { FolderPermissions } from './FolderPermissions';

// Like the real editor, the stand-in keeps what it loaded for the folder it started with.
jest.mock('app/core/components/AccessControl/Permissions', () => {
  const { useState } = jest.requireActual('react');
  return {
    Permissions: ({ canSetPermissions, resourceId }: { canSetPermissions: boolean; resourceId: string }) => {
      const [loadedFor] = useState(resourceId);
      return (
        <div
          data-testid="permissions"
          data-can-set={canSetPermissions}
          data-resource-id={resourceId}
          data-loaded-for={loadedFor}
        />
      );
    },
  };
});

jest.mock('app/features/provisioning/hooks/useFolderMetadataStatus', () => ({
  useFolderMetadataStatus: jest.fn(),
}));

const mockUseFolderMetadataStatus = jest.mocked(useFolderMetadataStatus);

const folder = mockFolderDTO(1, {
  uid: 'folder-1',
  accessControl: {
    [AccessControlAction.FoldersPermissionsRead]: true,
    [AccessControlAction.FoldersPermissionsWrite]: true,
  },
});
const provisionedFolder = { ...folder, managedBy: ManagerKind.Repo };

describe('FolderPermissions', () => {
  let originalProvisioningEnabled: boolean;

  beforeEach(() => {
    originalProvisioningEnabled = config.provisioningEnabled;
    config.provisioningEnabled = true;
    jest.clearAllMocks();
  });

  afterEach(() => {
    config.provisioningEnabled = originalProvisioningEnabled;
  });

  it('renders permissions directly when folder is not provisioned', () => {
    render(<FolderPermissions folder={folder} />);

    const permissions = screen.getByTestId('permissions');
    expect(permissions).toHaveAttribute('data-can-set', 'true');
    expect(permissions).toHaveAttribute('data-resource-id', 'folder-1');
    expect(mockUseFolderMetadataStatus).not.toHaveBeenCalled();
  });

  it('renders permissions directly when provisioning is disabled', () => {
    config.provisioningEnabled = false;

    render(<FolderPermissions folder={provisionedFolder} />);

    const permissions = screen.getByTestId('permissions');
    expect(permissions).toHaveAttribute('data-can-set', 'true');
    expect(permissions).toHaveAttribute('data-resource-id', 'folder-1');
  });

  it('renders read-only permissions for a provisioned folder that is missing its metadata', () => {
    mockUseFolderMetadataStatus.mockReturnValue({ status: 'missing', repositoryName: 'test-repo' });

    render(<FolderPermissions folder={provisionedFolder} />);

    expect(screen.getByText('This folder is missing metadata.')).toBeInTheDocument();
    expect(screen.getByTestId('permissions')).toHaveAttribute('data-can-set', 'false');
  });

  it('renders read-only permissions when the folder does not grant changing them', () => {
    const viewOnlyFolder = { ...folder, accessControl: { [AccessControlAction.FoldersPermissionsRead]: true } };

    render(<FolderPermissions folder={viewOnlyFolder} />);

    expect(screen.getByTestId('permissions')).toHaveAttribute('data-can-set', 'false');
  });

  it('explains when the folder does not grant viewing its permissions', () => {
    render(<FolderPermissions folder={{ ...folder, accessControl: {} }} />);

    expect(screen.getByText('You do not have permission to view the permissions of this folder.')).toBeInTheDocument();
    expect(screen.queryByTestId('permissions')).not.toBeInTheDocument();
  });

  it.each([
    { kind: 'folder', first: folder },
    { kind: 'provisioned folder', first: provisionedFolder },
  ])('starts the editor over when it is given another $kind', ({ first }) => {
    mockUseFolderMetadataStatus.mockReturnValue({ status: 'ok', repositoryName: 'test-repo' });
    const { rerender } = render(<FolderPermissions folder={first} />);
    expect(screen.getByTestId('permissions')).toHaveAttribute('data-loaded-for', 'folder-1');

    rerender(<FolderPermissions folder={{ ...first, uid: 'folder-2' }} />);

    // The editor acts on the folder it is given, so what it shows must have been loaded for that folder.
    const permissions = screen.getByTestId('permissions');
    expect(permissions).toHaveAttribute('data-resource-id', 'folder-2');
    expect(permissions).toHaveAttribute('data-loaded-for', 'folder-2');
  });
});

import { render, screen } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { ManagerKind } from 'app/features/apiserver/types';
import { mockFolderDTO } from 'app/features/browse-dashboards/fixtures/folder.fixture';
import { AccessControlAction } from 'app/types/accessControl';

import { useFolderMetadataStatus } from '../../hooks/useFolderMetadataStatus';

import { FolderPermissions } from './FolderPermissions';

jest.mock('app/core/components/AccessControl/Permissions', () => ({
  Permissions: ({ canSetPermissions, resourceId }: { canSetPermissions: boolean; resourceId: string }) => (
    <div data-testid="permissions" data-can-set={canSetPermissions} data-resource-id={resourceId} />
  ),
}));

jest.mock('../../hooks/useFolderMetadataStatus', () => ({
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

  it('renders loading state', () => {
    mockUseFolderMetadataStatus.mockReturnValue({ status: 'loading', repositoryName: 'test-repo' });

    render(<FolderPermissions folder={provisionedFolder} />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders warning banner and read-only permissions when metadata is missing', () => {
    mockUseFolderMetadataStatus.mockReturnValue({ status: 'missing', repositoryName: 'test-repo' });

    render(<FolderPermissions folder={provisionedFolder} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('This folder is missing metadata.')).toBeInTheDocument();

    const permissions = screen.getByTestId('permissions');
    expect(permissions).toHaveAttribute('data-can-set', 'false');
    expect(permissions).toHaveAttribute('data-resource-id', 'folder-1');
  });

  it('renders error alert when metadata check fails', () => {
    mockUseFolderMetadataStatus.mockReturnValue({ status: 'error', repositoryName: 'test-repo' });

    render(<FolderPermissions folder={provisionedFolder} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Unable to check folder metadata status.')).toBeInTheDocument();
  });

  it('renders permissions with the access the folder grants when metadata is ok', () => {
    mockUseFolderMetadataStatus.mockReturnValue({ status: 'ok', repositoryName: 'test-repo' });

    render(<FolderPermissions folder={provisionedFolder} />);

    const permissions = screen.getByTestId('permissions');
    expect(permissions).toHaveAttribute('data-can-set', 'true');
  });
});

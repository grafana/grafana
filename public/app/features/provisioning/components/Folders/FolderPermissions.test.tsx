import { render, screen } from 'test/test-utils';

import { config } from '@grafana/runtime';

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
    render(<FolderPermissions folderUID="folder-1" canSetPermissions={true} isProvisionedFolder={false} />);

    const permissions = screen.getByTestId('permissions');
    expect(permissions).toHaveAttribute('data-can-set', 'true');
    expect(permissions).toHaveAttribute('data-resource-id', 'folder-1');
    expect(mockUseFolderMetadataStatus).not.toHaveBeenCalled();
  });

  it('renders permissions directly when provisioning is disabled', () => {
    config.provisioningEnabled = false;

    render(<FolderPermissions folderUID="folder-1" canSetPermissions={true} isProvisionedFolder={true} />);

    const permissions = screen.getByTestId('permissions');
    expect(permissions).toHaveAttribute('data-can-set', 'true');
    expect(permissions).toHaveAttribute('data-resource-id', 'folder-1');
  });

  it('renders loading state', () => {
    mockUseFolderMetadataStatus.mockReturnValue({ status: 'loading', repositoryName: 'test-repo' });

    render(<FolderPermissions folderUID="folder-1" canSetPermissions={true} isProvisionedFolder={true} />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders warning banner and read-only permissions when metadata is missing', () => {
    mockUseFolderMetadataStatus.mockReturnValue({ status: 'missing', repositoryName: 'test-repo' });

    render(<FolderPermissions folderUID="folder-1" canSetPermissions={true} isProvisionedFolder={true} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('This folder is missing metadata.')).toBeInTheDocument();

    const permissions = screen.getByTestId('permissions');
    expect(permissions).toHaveAttribute('data-can-set', 'false');
    expect(permissions).toHaveAttribute('data-resource-id', 'folder-1');
  });

  it('renders error alert when metadata check fails', () => {
    mockUseFolderMetadataStatus.mockReturnValue({ status: 'error', repositoryName: 'test-repo' });

    render(<FolderPermissions folderUID="folder-1" canSetPermissions={true} isProvisionedFolder={true} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Unable to check folder metadata status.')).toBeInTheDocument();
  });

  it('renders permissions with original canSetPermissions when metadata is ok', () => {
    mockUseFolderMetadataStatus.mockReturnValue({ status: 'ok', repositoryName: 'test-repo' });

    render(<FolderPermissions folderUID="folder-1" canSetPermissions={true} isProvisionedFolder={true} />);

    const permissions = screen.getByTestId('permissions');
    expect(permissions).toHaveAttribute('data-can-set', 'true');
  });
});

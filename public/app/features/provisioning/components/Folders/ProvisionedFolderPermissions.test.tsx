import { render, screen } from 'test/test-utils';

import { useFolderMetadataStatus } from '../../hooks/useFolderMetadataStatus';

import { ProvisionedFolderPermissions } from './ProvisionedFolderPermissions';

jest.mock('app/core/components/AccessControl/Permissions', () => ({
  Permissions: ({ canSetPermissions, resourceId }: { canSetPermissions: boolean; resourceId: string }) => (
    <div data-testid="permissions" data-can-set={canSetPermissions} data-resource-id={resourceId} />
  ),
}));

jest.mock('../../hooks/useFolderMetadataStatus', () => ({
  useFolderMetadataStatus: jest.fn(),
}));

const mockUseFolderMetadataStatus = jest.mocked(useFolderMetadataStatus);

describe('ProvisionedFolderPermissions', () => {
  it('shows the permissions loader while the metadata is checked', () => {
    mockUseFolderMetadataStatus.mockReturnValue({ status: 'loading', repositoryName: 'test-repo' });

    render(<ProvisionedFolderPermissions folderUID="folder-1" canSetPermissions={true} />);

    // The editor's own loader has the same text, so the two stages read as one
    expect(screen.getByText('Loading permissions...')).toBeInTheDocument();
    expect(screen.queryByTestId('permissions')).not.toBeInTheDocument();
  });

  it('renders warning banner and read-only permissions when metadata is missing', () => {
    mockUseFolderMetadataStatus.mockReturnValue({ status: 'missing', repositoryName: 'test-repo' });

    render(<ProvisionedFolderPermissions folderUID="folder-1" canSetPermissions={true} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('This folder is missing metadata.')).toBeInTheDocument();

    const permissions = screen.getByTestId('permissions');
    expect(permissions).toHaveAttribute('data-can-set', 'false');
    expect(permissions).toHaveAttribute('data-resource-id', 'folder-1');
  });

  it('renders error alert when metadata check fails', () => {
    mockUseFolderMetadataStatus.mockReturnValue({ status: 'error', repositoryName: 'test-repo' });

    render(<ProvisionedFolderPermissions folderUID="folder-1" canSetPermissions={true} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Unable to check folder metadata status.')).toBeInTheDocument();
  });

  it('renders permissions with original canSetPermissions when metadata is ok', () => {
    mockUseFolderMetadataStatus.mockReturnValue({ status: 'ok', repositoryName: 'test-repo' });

    render(<ProvisionedFolderPermissions folderUID="folder-1" canSetPermissions={true} />);

    const permissions = screen.getByTestId('permissions');
    expect(permissions).toHaveAttribute('data-can-set', 'true');
  });
});

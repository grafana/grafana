import { render, screen, testWithFeatureToggles } from 'test/test-utils';

import { config } from '@grafana/runtime';

import { FolderMetadataStatus } from '../../hooks/useFolderMetadataStatus';

import { FolderPermissions, MissingFolderMetadataBanner } from './MissingFolderMetadataBanner';

jest.mock('app/core/components/AccessControl/Permissions', () => ({
  Permissions: ({ canSetPermissions, resourceId }: { canSetPermissions: boolean; resourceId: string }) => (
    <div data-testid="permissions" data-can-set={canSetPermissions} data-resource-id={resourceId} />
  ),
}));

jest.mock('../../hooks/useFolderMetadataStatus', () => ({
  useFolderMetadataStatus: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useFolderMetadataStatus } = require('../../hooks/useFolderMetadataStatus');

describe('MissingFolderMetadataBanner', () => {
  it('renders warning alert with correct content', () => {
    render(<MissingFolderMetadataBanner />);

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(screen.getByText('This folder is missing metadata.')).toBeInTheDocument();
    expect(
      screen.getByText(
        "Since this folder doesn't contain a metadata file, the folder ID is based on the folder path. If you move or rename the folder, the folder ID will change, and permissions may no longer apply to the folder."
      )
    ).toBeInTheDocument();
  });
});

describe('FolderPermissions', () => {
  testWithFeatureToggles({ enable: ['provisioning', 'provisioningFolderMetadata'] });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders permissions directly when folder is not provisioned', () => {
    render(<FolderPermissions folderUID="folder-1" canSetPermissions={true} isProvisionedFolder={false} />);

    const permissions = screen.getByTestId('permissions');
    expect(permissions).toHaveAttribute('data-can-set', 'true');
    expect(permissions).toHaveAttribute('data-resource-id', 'folder-1');
    expect(useFolderMetadataStatus).not.toHaveBeenCalled();
  });

  it('renders permissions directly when feature toggles are disabled', () => {
    config.featureToggles.provisioning = false;

    render(<FolderPermissions folderUID="folder-1" canSetPermissions={true} isProvisionedFolder={true} />);

    const permissions = screen.getByTestId('permissions');
    expect(permissions).toHaveAttribute('data-can-set', 'true');
    expect(permissions).toHaveAttribute('data-resource-id', 'folder-1');
  });

  it('renders loading state', () => {
    useFolderMetadataStatus.mockReturnValue('loading' as FolderMetadataStatus);

    render(<FolderPermissions folderUID="folder-1" canSetPermissions={true} isProvisionedFolder={true} />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders warning banner and read-only permissions when metadata is missing', () => {
    useFolderMetadataStatus.mockReturnValue('missing' as FolderMetadataStatus);

    render(<FolderPermissions folderUID="folder-1" canSetPermissions={true} isProvisionedFolder={true} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('This folder is missing metadata.')).toBeInTheDocument();

    const permissions = screen.getByTestId('permissions');
    expect(permissions).toHaveAttribute('data-can-set', 'false');
    expect(permissions).toHaveAttribute('data-resource-id', 'folder-1');
  });

  it('renders error alert when metadata check fails', () => {
    useFolderMetadataStatus.mockReturnValue('error' as FolderMetadataStatus);

    render(<FolderPermissions folderUID="folder-1" canSetPermissions={true} isProvisionedFolder={true} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Unable to check folder metadata status.')).toBeInTheDocument();
  });

  it('renders permissions with original canSetPermissions when metadata is ok', () => {
    useFolderMetadataStatus.mockReturnValue('ok' as FolderMetadataStatus);

    render(<FolderPermissions folderUID="folder-1" canSetPermissions={true} isProvisionedFolder={true} />);

    const permissions = screen.getByTestId('permissions');
    expect(permissions).toHaveAttribute('data-can-set', 'true');
  });
});

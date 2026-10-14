import { render, screen } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { getFolderFixtures } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';

import * as permissions from '../permissions';

import { FolderPermissionsExposedComponentLazy } from './FolderPermissionsExposedComponentLazy';

setBackendSrv(backendSrv);
setupMockServer();

jest.mock('app/core/components/AccessControl/Permissions', () => ({
  Permissions: ({ resourceId, canSetPermissions }: { resourceId: string; canSetPermissions: boolean }) => (
    <div>{`Permissions for ${resourceId}, ${canSetPermissions ? 'editable' : 'read only'}`}</div>
  ),
}));

const [_, { folderA }] = getFolderFixtures();
const folderUid = folderA.item.uid;

const access = {
  canCreateDashboards: false,
  canEditDashboards: false,
  canCreateFolders: false,
  canDeleteFolders: false,
  canEditFolders: false,
  canViewPermissions: true,
  canSetPermissions: true,
  canDeleteDashboards: false,
};

describe('grafana/folder-permissions/v1', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the folder permissions editor for the named folder', async () => {
    jest.spyOn(permissions, 'getFolderPermissions').mockReturnValue(access);
    render(<FolderPermissionsExposedComponentLazy folderUid={folderUid} />);

    expect(await screen.findByText(`Permissions for ${folderUid}, editable`)).toBeInTheDocument();
    expect(permissions.getFolderPermissions).toHaveBeenCalledWith(expect.objectContaining({ uid: folderUid }));
  });

  it('is read only for people who can view but not change the permissions', async () => {
    jest.spyOn(permissions, 'getFolderPermissions').mockReturnValue({ ...access, canSetPermissions: false });
    render(<FolderPermissionsExposedComponentLazy folderUid={folderUid} />);

    expect(await screen.findByText(`Permissions for ${folderUid}, read only`)).toBeInTheDocument();
  });

  it('explains when the permissions cannot be viewed', async () => {
    jest
      .spyOn(permissions, 'getFolderPermissions')
      .mockReturnValue({ ...access, canViewPermissions: false, canSetPermissions: false });
    render(<FolderPermissionsExposedComponentLazy folderUid={folderUid} />);

    expect(
      await screen.findByText('You do not have permission to view the permissions of this folder.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/Permissions for/)).not.toBeInTheDocument();
  });

  it('reports a folder that cannot be loaded', async () => {
    render(<FolderPermissionsExposedComponentLazy folderUid="does-not-exist" />);

    expect(await screen.findByText('Unable to load this folder.')).toBeInTheDocument();
  });

  it('renders nothing when no folder is named', () => {
    const { container } = render(<FolderPermissionsExposedComponentLazy />);

    expect(container).toBeEmptyDOMElement();
  });
});

import { delay, http, HttpResponse } from 'msw';
import { render, screen } from 'test/test-utils';

import { config, setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { getFolderFixtures } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { FolderPermissionsExposedComponentLazy } from './FolderPermissionsExposedComponentLazy';

setBackendSrv(backendSrv);
setupMockServer();

// Every render is recorded, so a test can tell that an editor never showed, even for one render.
const mockRenderedEditors: string[] = [];
jest.mock('app/core/components/AccessControl/Permissions', () => ({
  Permissions: ({ resourceId, canSetPermissions }: { resourceId: string; canSetPermissions: boolean }) => {
    const editor = `Permissions for ${resourceId}, ${canSetPermissions ? 'editable' : 'read only'}`;
    mockRenderedEditors.push(editor);
    return <div>{editor}</div>;
  },
}));

const [_, { folderA, folderB }] = getFolderFixtures();
const folderUid = folderA.item.uid;
const otherFolderUid = folderB.item.uid;

const viewAccess = { [AccessControlAction.FoldersPermissionsRead]: true };
const editAccess = { ...viewAccess, [AccessControlAction.FoldersPermissionsWrite]: true };

/** Sets what the access endpoint grants for each folder. `slowFolder` answers after its folder has loaded. */
function setAccess(accessByFolder: Record<string, Record<string, boolean>>, slowFolder?: string) {
  server.use(
    http.get<{ folderUid: string }>(
      '/apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders/:folderUid/access',
      async ({ params }) => {
        if (params.folderUid === slowFolder) {
          await delay(50);
        }
        return HttpResponse.json({
          kind: 'FolderAccessInfo',
          apiVersion: 'folder.grafana.app/v1beta1',
          canAdmin: false,
          canDelete: false,
          canEdit: false,
          canSave: false,
          accessControl: accessByFolder[params.folderUid] ?? {},
        });
      }
    )
  );
}

describe('grafana/folder-permissions/v1', () => {
  const originalSharedWithMeFolderUID = config.sharedWithMeFolderUID;

  beforeEach(() => {
    mockRenderedEditors.length = 0;
  });

  afterEach(() => {
    config.sharedWithMeFolderUID = originalSharedWithMeFolderUID;
  });

  it('renders the folder permissions editor for the named folder', async () => {
    setAccess({ [folderUid]: editAccess });
    render(<FolderPermissionsExposedComponentLazy folderUid={folderUid} />);

    expect(await screen.findByText(`Permissions for ${folderUid}, editable`)).toBeInTheDocument();
  });

  it('is read only for people who can view but not change the permissions', async () => {
    setAccess({ [folderUid]: viewAccess });
    render(<FolderPermissionsExposedComponentLazy folderUid={folderUid} />);

    expect(await screen.findByText(`Permissions for ${folderUid}, read only`)).toBeInTheDocument();
  });

  it('explains when the permissions cannot be viewed', async () => {
    setAccess({});
    render(<FolderPermissionsExposedComponentLazy folderUid={folderUid} />);

    expect(
      await screen.findByText('You do not have permission to view the permissions of this folder.')
    ).toBeInTheDocument();
    expect(mockRenderedEditors).toEqual([]);
  });

  it('shows loading when the host names a different folder, never the previous folder or its access', async () => {
    setAccess({ [folderUid]: editAccess, [otherFolderUid]: viewAccess }, otherFolderUid);
    const { rerender } = render(<FolderPermissionsExposedComponentLazy folderUid={folderUid} />);
    expect(await screen.findByText(`Permissions for ${folderUid}, editable`)).toBeInTheDocument();

    rerender(<FolderPermissionsExposedComponentLazy folderUid={otherFolderUid} />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText(`Permissions for ${folderUid}, editable`)).not.toBeInTheDocument();
    expect(await screen.findByText(`Permissions for ${otherFolderUid}, read only`)).toBeInTheDocument();
    expect(mockRenderedEditors).not.toContain(`Permissions for ${otherFolderUid}, editable`);
  });

  it('reports a folder that cannot be loaded', async () => {
    render(<FolderPermissionsExposedComponentLazy folderUid="does-not-exist" />);

    expect(await screen.findByText('Unable to load this folder.')).toBeInTheDocument();
  });

  it.each(['general', 'sharedwithme'])('reports the virtual folder "%s" as one that cannot be loaded', async (uid) => {
    config.sharedWithMeFolderUID = 'sharedwithme';
    setAccess({ [uid]: editAccess });
    render(<FolderPermissionsExposedComponentLazy folderUid={uid} />);

    expect(await screen.findByText('Unable to load this folder.')).toBeInTheDocument();
    expect(mockRenderedEditors).toEqual([]);
  });

  it('renders nothing when no folder is named', () => {
    const { container } = render(<FolderPermissionsExposedComponentLazy />);

    expect(container).toBeEmptyDOMElement();
  });
});

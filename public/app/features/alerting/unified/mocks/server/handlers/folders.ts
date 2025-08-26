import { HttpResponse, http } from 'msw';

import { mockFolder } from 'app/features/alerting/unified/mocks';
import { grafanaRulerRule } from 'app/features/alerting/unified/mocks/grafanaRulerApi';
import { FolderDTO } from 'app/types/folders';

export const DEFAULT_FOLDERS: FolderDTO[] = [
  mockFolder({
    id: 1,
    uid: 'e3d1f4fd-9e7c-4f63-9a9e-2b5a1d2e6a9c',
    title: 'Alerting-folder',
  }),
  mockFolder({
    id: 2,
    uid: grafanaRulerRule.grafana_alert.namespace_uid,
    title: 'Folder A',
  }),
  mockFolder({
    id: 3,
    uid: 'NAMESPACE_UID',
    title: 'Some Folder',
  }),
];

export const getFolderHandler = (responseOverride?: FolderDTO) =>
  http.get<{ folderUid: string }>(`/api/folders/:folderUid`, ({ request, params }) => {
    const matchingFolder = DEFAULT_FOLDERS.find((folder) => folder.uid === params.folderUid);
    const response = responseOverride || matchingFolder;

    if (!response) {
      return HttpResponse.json({ message: 'folder not found', status: 'not-found' }, { status: 404 });
    }

    const { accessControl, ...withoutAccessControl } = response;

    // Server only responds with ACL if query param is sent
    const accessControlQueryParam = new URL(request.url).searchParams.get('accesscontrol');
    if (!accessControlQueryParam) {
      return HttpResponse.json(withoutAccessControl);
    }

    return HttpResponse.json(response);
  });

const listFoldersHandler = (folders = DEFAULT_FOLDERS) =>
  http.get(`/api/folders`, () => {
    const strippedFolders = folders.map(({ id, uid, title }) => {
      return { id, uid, title };
    });
    // TODO: Add pagination/permission support here as required by tests
    // TODO: Add parentUid logic when clicking to expand nested folders
    return HttpResponse.json(strippedFolders);
  });

const handlers = [listFoldersHandler(), getFolderHandler()];

export default handlers;

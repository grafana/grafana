import { HttpResponse, http } from 'msw';

import { type DashboardHit } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { type Folder, type FolderAccessInfo, type FolderInfoList } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { getCustomSearchHandler } from '@grafana/test-utils/handlers';
import { folderHandlers } from '@grafana/test-utils/unstable';
import { mockFolder } from 'app/features/alerting/unified/mocks';
import { grafanaRulerRule } from 'app/features/alerting/unified/mocks/grafanaRulerApi';
import { type FolderDTO } from 'app/types/folders';

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

/** Title of the "happy path" folder used across alerting rule-editor tests. Derived from DEFAULT_FOLDERS[1]. */
export const FOLDER_TITLE_HAPPY_PATH = DEFAULT_FOLDERS[1].title;

const { FOLDERS, FOLDER_BY_NAME, buildFolderResource } = folderHandlers;
const API_VERSION = 'folder.grafana.app/v1beta1';

/** The Folder resource served from `.../folders/:name`. */
const toFolderResource = (folder: FolderDTO): Folder =>
  buildFolderResource({
    uid: folder.uid,
    title: folder.title,
    id: folder.id,
    parentUid: folder.parentUid,
    managedBy: folder.managedBy,
    managerId: folder.managerId,
    created: folder.created || undefined,
    updated: folder.updated || undefined,
    generation: folder.version ?? 1,
  });

/** The `.../folders/:name/access` response. */
const toAccessInfo = (folder: FolderDTO): FolderAccessInfo => ({
  kind: 'FolderAccessInfo',
  apiVersion: API_VERSION,
  canAdmin: folder.canAdmin,
  canDelete: folder.canDelete,
  canEdit: folder.canEdit,
  canSave: folder.canSave,
  accessControl: folder.accessControl ?? {},
});

/** The `.../folders/:name/parents` response: the configured ancestors root-first, ending with the folder itself. */
const toParents = (folder: FolderDTO): FolderInfoList => {
  const ancestors = folder.parents ?? [];
  return {
    kind: 'FolderInfoList',
    apiVersion: API_VERSION,
    metadata: {},
    items: [
      ...ancestors.map(({ uid, title }, index) => ({ name: uid, title, parent: ancestors[index - 1]?.uid })),
      { name: folder.uid, title: folder.title, parent: folder.parentUid ?? ancestors.at(-1)?.uid },
    ],
  };
};

/**
 * Folder/access/parents handlers for a single folder. Missing fields are filled from `mockFolder`. Scoped to the
 * folder's UID so requests for other folders fall through to the default handlers.
 */
export const getFolderHandlers = (folder: Partial<FolderDTO>) => {
  const filled = mockFolder(folder);
  const folderUrl = `${FOLDERS}/${filled.uid}`;
  return [
    http.get(folderUrl, () => HttpResponse.json(toFolderResource(filled))),
    http.get(`${folderUrl}/access`, () => HttpResponse.json(toAccessInfo(filled))),
    http.get(`${folderUrl}/parents`, () => HttpResponse.json(toParents(filled))),
  ];
};

/**
 * Access handler that reports the given access control for every folder. Only `/access` is overridden: the folder
 * itself must exist, either in `DEFAULT_FOLDERS` or seeded with `getFolderHandlers`, or `useGetCombinedFolderQuery` reports a 404.
 */
export const getFolderAccessHandler = (accessControl: FolderDTO['accessControl']) =>
  http.get(`${FOLDER_BY_NAME}/access`, () => HttpResponse.json(toAccessInfo(mockFolder({ accessControl }))));

const DEFAULT_FOLDER_HITS: DashboardHit[] = DEFAULT_FOLDERS.map((folder) => ({
  resource: 'folders',
  name: folder.uid,
  title: folder.title,
  folder: folder.parentUid,
  field: {},
}));

const respondForDefaultFolder = (
  folderUid: string,
  build: (folder: FolderDTO) => Folder | FolderAccessInfo | FolderInfoList
) => {
  const folder = DEFAULT_FOLDERS.find((candidate) => candidate.uid === folderUid);
  if (!folder) {
    return HttpResponse.json(
      {
        kind: 'Status',
        apiVersion: 'v1',
        status: 'Failure',
        message: 'folder not found',
        reason: 'NotFound',
        code: 404,
      },
      { status: 404 }
    );
  }
  return HttpResponse.json(build(folder));
};

/**
 * Default alerting folder handlers: folder/access/parents for `DEFAULT_FOLDERS` plus a dashboard-search handler so the
 * rule-editor folder picker lists them.
 */
const handlers = [
  http.get<{ folderUid: string }>(FOLDER_BY_NAME, ({ params }) =>
    respondForDefaultFolder(params.folderUid, toFolderResource)
  ),
  http.get<{ folderUid: string }>(`${FOLDER_BY_NAME}/access`, ({ params }) =>
    respondForDefaultFolder(params.folderUid, toAccessInfo)
  ),
  http.get<{ folderUid: string }>(`${FOLDER_BY_NAME}/parents`, ({ params }) =>
    respondForDefaultFolder(params.folderUid, toParents)
  ),
  getCustomSearchHandler(DEFAULT_FOLDER_HITS),
];

export default handlers;

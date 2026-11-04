import { HttpResponse, http } from 'msw';

import { type DashboardHit } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { type Folder, type FolderAccessInfo, type FolderInfoList } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { getCustomSearchHandler } from '@grafana/test-utils/handlers';
import { mockFolder } from 'app/features/alerting/unified/mocks';
import { grafanaRulerRule } from 'app/features/alerting/unified/mocks/grafanaRulerApi';
import {
  AnnoKeyFolder,
  AnnoKeyManagerIdentity,
  AnnoKeyManagerKind,
  AnnoKeyUpdatedTimestamp,
  DeprecatedInternalId,
} from 'app/features/apiserver/types';
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

const API_VERSION = 'folder.grafana.app/v1beta1';
const FOLDERS_URL = `/apis/${API_VERSION}/namespaces/:namespace/folders`;

const folderNotFound = () =>
  HttpResponse.json(
    { kind: 'Status', apiVersion: 'v1', status: 'Failure', message: 'folder not found', reason: 'NotFound', code: 404 },
    { status: 404 }
  );

/** Builds the app platform Folder resource the facade fetches from `.../folders/:name`. */
const toAppPlatformFolder = (folder: FolderDTO): Folder => ({
  kind: 'Folder',
  apiVersion: API_VERSION,
  metadata: {
    name: folder.uid,
    namespace: 'default',
    uid: folder.uid,
    creationTimestamp: folder.created || '2023-01-01T00:00:00Z',
    generation: folder.version ?? 1,
    annotations: {
      [AnnoKeyUpdatedTimestamp]: folder.updated || '2024-01-01T00:00:00Z',
      ...(folder.managedBy ? { [AnnoKeyManagerKind]: folder.managedBy } : {}),
      ...(folder.managerId ? { [AnnoKeyManagerIdentity]: folder.managerId } : {}),
      ...(folder.parentUid ? { [AnnoKeyFolder]: folder.parentUid } : {}),
    },
    labels: {
      [DeprecatedInternalId]: String(folder.id),
    },
  },
  spec: { title: folder.title, description: '' },
});

/** Builds the `.../folders/:name/access` response. */
const toAppPlatformAccess = (folder: FolderDTO): FolderAccessInfo => ({
  kind: 'FolderAccessInfo',
  apiVersion: API_VERSION,
  canAdmin: folder.canAdmin,
  canDelete: folder.canDelete,
  canEdit: folder.canEdit,
  canSave: folder.canSave,
  accessControl: folder.accessControl ?? {},
});

/** Builds the `.../folders/:name/parents` response. The chain ends with the folder itself. */
const toAppPlatformParents = (folder: FolderDTO): FolderInfoList => ({
  kind: 'FolderInfoList',
  apiVersion: API_VERSION,
  metadata: {},
  items: [{ name: folder.uid, title: folder.title, parent: folder.parentUid }],
});

/** Folder/access/parents handlers that resolve each requested UID, 404ing when unknown. */
const folderResourceHandlers = (resolve: (folderUid: string) => FolderDTO | undefined) => [
  http.get<{ folderUid: string }>(`${FOLDERS_URL}/:folderUid`, ({ params }) => {
    const folder = resolve(params.folderUid);
    return folder ? HttpResponse.json(toAppPlatformFolder(folder)) : folderNotFound();
  }),
  http.get<{ folderUid: string }>(`${FOLDERS_URL}/:folderUid/access`, ({ params }) => {
    const folder = resolve(params.folderUid);
    return folder ? HttpResponse.json(toAppPlatformAccess(folder)) : folderNotFound();
  }),
  http.get<{ folderUid: string }>(`${FOLDERS_URL}/:folderUid/parents`, ({ params }) => {
    const folder = resolve(params.folderUid);
    return folder ? HttpResponse.json(toAppPlatformParents(folder)) : folderNotFound();
  }),
];

/**
 * App platform folder/access/parents handlers scoped to a single folder. Missing fields are filled from `mockFolder`.
 * Scoped to the folder's UID so requests for other folders fall through to the default handlers.
 */
export const getFolderHandlers = (folder: Partial<FolderDTO>) => {
  const filled = mockFolder(folder);
  const folderUrl = `${FOLDERS_URL}/${filled.uid}`;
  return [
    http.get(folderUrl, () => HttpResponse.json(toAppPlatformFolder(filled))),
    http.get(`${folderUrl}/access`, () => HttpResponse.json(toAppPlatformAccess(filled))),
    http.get(`${folderUrl}/parents`, () => HttpResponse.json(toAppPlatformParents(filled))),
  ];
};

/**
 * App platform folder handlers that respond for any folder UID with the given access control. Known folders keep their
 * default title; unknown ones are synthesized. Mirrors the legacy "respond for every folder" behaviour.
 */
export const getFolderAccessControlHandlers = (accessControl: FolderDTO['accessControl']) =>
  folderResourceHandlers((folderUid) => {
    const base = DEFAULT_FOLDERS.find((folder) => folder.uid === folderUid) ?? mockFolder({ uid: folderUid });
    return { ...base, uid: folderUid, hasAcl: true, accessControl };
  });

const DEFAULT_FOLDER_HITS: DashboardHit[] = DEFAULT_FOLDERS.map((folder) => ({
  resource: 'folders',
  name: folder.uid,
  title: folder.title,
  folder: folder.parentUid,
  field: {},
}));

/**
 * Default alerting folder handlers: folder/access/parents for `DEFAULT_FOLDERS` plus a dashboard-search handler so the
 * rule-editor folder picker lists them.
 */
const handlers = [
  ...folderResourceHandlers((folderUid) => DEFAULT_FOLDERS.find((folder) => folder.uid === folderUid)),
  getCustomSearchHandler(DEFAULT_FOLDER_HITS),
];

export default handlers;

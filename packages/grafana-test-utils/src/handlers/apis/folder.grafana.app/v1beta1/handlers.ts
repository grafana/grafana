import { Chance } from 'chance';
import { HttpResponse, http } from 'msw';

import { wellFormedTree } from '../../../../fixtures/folders';
import { getErrorResponse } from '../../../helpers';

const [mockTree] = wellFormedTree();

const baseResponse = {
  kind: 'Folder',
  apiVersion: 'folder.grafana.app/v1beta1',
};

const folderToAppPlatform = (folder: (typeof mockTree)[number]['item'], id?: number, namespace?: string) => {
  return {
    ...baseResponse,

    metadata: {
      name: folder.uid,
      namespace: namespace ?? 'default',
      uid: folder.uid,
      creationTimestamp: '2023-01-01T00:00:00Z',
      annotations: {
        // TODO: Generalise annotations in fixture data
        'grafana.app/createdBy': 'user:1',
        'grafana.app/updatedBy': 'user:2',
        'grafana.app/managedBy': 'user',
        'grafana.app/updatedTimestamp': '2024-01-01T00:00:00Z',
        'grafana.app/folder': folder.kind === 'folder' ? folder.parentUID : undefined,
      },
      labels: {
        'grafana.app/deprecatedInternalID': id ?? '123',
      },
    },
    spec: { title: folder.title, description: '' },
    status: {},
  };
};

const folderNotFoundError = getErrorResponse('folder not found', 404);

const getFolderHandler = () =>
  http.get<{ folderUid: string; namespace: string }>(
    '/apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders/:folderUid',
    ({ params }) => {
      const { folderUid, namespace } = params;
      const response = mockTree.find(({ item }) => {
        return item.uid === folderUid;
      });

      if (!response) {
        return HttpResponse.json(folderNotFoundError, { status: 404 });
      }

      const appPlatformFolder = folderToAppPlatform(response.item, undefined, namespace);

      return HttpResponse.json(appPlatformFolder);
    }
  );

const getFolderParentsHandler = () =>
  http.get<{ folderUid: string; namespace: string }>(
    '/apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders/:folderUid/parents',
    ({ params }) => {
      const { folderUid } = params;

      const folder = mockTree.find(({ item }) => {
        return item.kind === 'folder' && item.uid === folderUid;
      });
      if (!folder || folder.item.kind !== 'folder') {
        return HttpResponse.json(folderNotFoundError, { status: 404 });
      }

      const findParents = (parents: Array<(typeof mockTree)[number]>, folderUid?: string) => {
        if (!folderUid) {
          return parents;
        }

        const parent = mockTree.find(({ item }) => {
          return item.kind === 'folder' && item.uid === folderUid;
        });

        if (parent) {
          parents.push(parent);
          return findParents(parents, parent.item.kind === 'folder' ? parent.item.parentUID : undefined);
        }
        return parents;
      };

      const parents = findParents([], folder?.item?.parentUID);

      const mapped = parents.map((parent) => ({
        name: parent.item.uid,
        title: parent.item.title,
        parentUid: parent.item.kind === 'folder' ? parent.item.parentUID : undefined,
      }));

      if (folder) {
        mapped.push({
          name: folder.item.uid,
          title: folder.item.title,
          parentUid: folder.item.parentUID,
        });
      }

      return HttpResponse.json({
        ...baseResponse,
        kind: 'FolderInfoList',
        metadata: {},
        items: mapped,
      });
    }
  );

// TODO: Pull this from common API types rather than partially redefining here
type PartialFolderPayload = { spec: { title: string }; metadata: { annotations: Record<string, string> } };

const createFolderHandler = () =>
  http.post<{ namespace: string }, PartialFolderPayload>(
    '/apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders',
    async ({ params, request }) => {
      const { namespace } = params;
      const body = await request.json();
      const title = body?.spec?.title;
      if (!body || !title) {
        return HttpResponse.json(getErrorResponse('folder title cannot be empty', 400), { status: 400 });
      }

      const parentUid = body?.metadata?.annotations?.['grafana.app/folder'];
      const random = Chance(title);
      const uid = random.string({ length: 45 });
      const id = random.integer({ min: 1, max: 1000 });

      const appPlatformFolder = folderToAppPlatform(
        { uid, title, parentUID: parentUid, kind: 'folder' },
        id,
        namespace
      );
      return HttpResponse.json(appPlatformFolder);
    }
  );

const replaceFolderHandler = () =>
  http.put<{ folderUid: string; namespace: string }, PartialFolderPayload>(
    '/apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders/:folderUid',
    async ({ params, request }) => {
      const body = await request.json();
      const { folderUid } = params;
      const response = mockTree.find(({ item }) => {
        return item.uid === folderUid;
      });

      if (!response) {
        return HttpResponse.json(folderNotFoundError, { status: 404 });
      }

      const modifiedFolder = {
        ...response.item,
        title: body.spec.title,
      };

      const appPlatformFolder = folderToAppPlatform(modifiedFolder);

      return HttpResponse.json(appPlatformFolder);
    }
  );

const getMockFolderCounts = (folders: number, dashboards: number, library_elements: number, alertrules: number) => {
  return {
    kind: 'DescendantCounts',
    apiVersion: 'folder.grafana.app/v1beta1',
    counts: [
      {
        group: 'dashboard.grafana.app',
        resource: 'dashboards',
        count: dashboards,
      },
      {
        group: 'sql-fallback',
        resource: 'alertrules',
        count: alertrules,
      },
      {
        group: 'sql-fallback',
        resource: 'dashboards',
        count: dashboards,
      },
      {
        group: 'sql-fallback',
        resource: 'folders',
        count: folders,
      },
      {
        group: 'sql-fallback',
        resource: 'library_elements',
        count: library_elements,
      },
    ],
  };
};

const folderCountsHandler = () =>
  http.get<{ folderUid: string; namespace: string }, PartialFolderPayload>(
    '/apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders/:folderUid/counts',
    async ({ params }) => {
      const { folderUid } = params;
      const matchedFolder = mockTree.find(({ item }) => {
        return item.uid === folderUid;
      });

      if (!matchedFolder) {
        // The API returns 0's for a folder that doesn't exist 🤷‍♂️
        return HttpResponse.json(getMockFolderCounts(0, 0, 0, 0));
      }

      return HttpResponse.json(getMockFolderCounts(1, 1, 1, 1));
    }
  );

export default [
  getFolderHandler(),
  getFolderParentsHandler(),
  createFolderHandler(),
  replaceFolderHandler(),
  folderCountsHandler(),
];

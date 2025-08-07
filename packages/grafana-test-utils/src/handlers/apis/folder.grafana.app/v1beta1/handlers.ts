import { HttpResponse, http } from 'msw';

import { wellFormedTree } from '../../../../fixtures/folders';

const [mockTree] = wellFormedTree();

const getFolderHandler = () =>
  http.get<{ folderUid: string; namespace: string }>(
    '/apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders/:folderUid',
    ({ params }) => {
      const { folderUid, namespace } = params;
      const response = mockTree.find(({ item }) => {
        return item.uid === folderUid;
      });

      if (!response) {
        return HttpResponse.json(
          {
            kind: 'Status',
            apiVersion: 'v1',
            metadata: {},
            status: 'Failure',
            message: 'folder not found',
            code: 404,
          },
          { status: 404 }
        );
      }

      return HttpResponse.json({
        kind: 'Folder',
        apiVersion: 'folder.grafana.app/v1beta1',
        metadata: {
          name: response.item.uid,
          namespace,
          uid: response.item.uid,
          creationTimestamp: '2023-01-01T00:00:00Z',
          annotations: {
            // TODO: Generalise annotations in fixture data
            'grafana.app/createdBy': 'user:1',
            'grafana.app/updatedBy': 'user:2',
            'grafana.app/managedBy': 'user',
            'grafana.app/updatedTimestamp': '2024-01-01T00:00:00Z',
            'grafana.app/folder': response.item.kind === 'folder' ? response.item.parentUID : undefined,
          },
          labels: {
            'grafana.app/deprecatedInternalID': '123',
          },
        },
        spec: { title: response.item.title, description: '' },
        status: {},
      });
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

      const findParents = (parents: any[], folderUid?: string) => {
        if (!folderUid) {
          return parents;
        }

        const parent = mockTree.find(({ item }) => {
          return item.kind === 'folder' && item.uid === folderUid;
        });

        if (parent) {
          parents.push(parent);
          return findParents(parents, parent.item.parentUID);
        }
        return parents;
      };

      const parents = findParents([], folder?.item?.parentUID);

      const mapped = parents.map((parent) => ({
        name: parent.item.uid,
        title: parent.item.title,
        parentUid: parent.item.parentUID,
      }));

      if (folder) {
        mapped.push({
          name: folder.item.uid,
          title: folder.item.title,
          parentUid: folder.item.parentUID,
        });
      }

      // TODO: Implement mock parent search logic
      return HttpResponse.json({
        kind: 'FolderInfoList',
        apiVersion: 'folder.grafana.app/v1beta1',
        metadata: {},
        items: mapped,
      });
    }
  );

export default [getFolderHandler(), getFolderParentsHandler()];

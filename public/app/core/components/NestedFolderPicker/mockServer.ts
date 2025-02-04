import { HttpResponse, http } from 'msw';
import { SetupServer, setupServer } from 'msw/node';

import {
  treeViewersCanEdit,
  wellFormedTree,
} from '../../../features/browse-dashboards/fixtures/dashboardsTreeItem.fixture';

export type { SetupServer };

export const [mockTree, { folderA, folderB, folderC, folderA_folderA, folderA_folderB }] = wellFormedTree();
export const [mockTreeThatViewersCanEdit /* shares folders with wellFormedTree */] = treeViewersCanEdit();

export function jestRegisterMockServer() {
  let server: SetupServer;

  beforeAll(() => {
    server = createMockFoldersServer();
    server.listen();
  });

  afterAll(() => {
    server.close();
  });

  afterEach(() => {
    server.resetHandlers();
  });
}

export function createMockFoldersServer() {
  const server = setupServer(
    http.get('/api/folders/:uid', () => {
      return HttpResponse.json({
        title: folderA.item.title,
        uid: folderA.item.uid,
      });
    }),

    http.get('/api/folders', ({ request }) => {
      const url = new URL(request.url);
      const parentUid = url.searchParams.get('parentUid') ?? undefined;
      const permission = url.searchParams.get('permission');

      const limit = parseInt(url.searchParams.get('limit') ?? '1000', 10);
      const page = parseInt(url.searchParams.get('page') ?? '1', 10);

      const tree = permission === 'Edit' ? mockTreeThatViewersCanEdit : mockTree;

      // reconstruct a folder API response from the flat tree fixture
      const folders = tree
        .filter((v) => v.item.kind === 'folder' && v.item.parentUID === parentUid)
        .map((folder) => {
          return {
            uid: folder.item.uid,
            title: folder.item.kind === 'folder' ? folder.item.title : "invalid - this shouldn't happen",
          };
        })
        .slice(limit * (page - 1), limit * page);

      return HttpResponse.json(folders);
    })
  );

  return server;
}

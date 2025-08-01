import { HttpResponse, http } from 'msw';

import { treeViewersCanEdit, wellFormedTree } from '../../../fixtures/folders';

const [mockTree] = wellFormedTree();
const [mockTreeThatViewersCanEdit] = treeViewersCanEdit();
const collator = new Intl.Collator();

const listFoldersHandler = () =>
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
      .sort((a, b) => collator.compare(a.title, b.title)) // API always sorts by title
      .slice(limit * (page - 1), limit * page);

    return HttpResponse.json(folders);
  });

const getFolderHandler = () =>
  http.get('/api/folders/:uid', ({ params }) => {
    const { uid } = params;

    const folder = mockTree.find((v) => v.item.uid === uid);
    if (!folder) {
      return HttpResponse.json({ message: 'folder not found', status: 'not-found' }, { status: 404 });
    }

    return HttpResponse.json({
      title: folder?.item.title,
      uid: folder?.item.uid,
    });
  });

const handlers = [listFoldersHandler(), getFolderHandler()];

export default handlers;

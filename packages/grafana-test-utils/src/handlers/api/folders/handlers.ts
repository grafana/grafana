import { Chance } from 'chance';
import { HttpResponse, http } from 'msw';

import { treeViewersCanEdit, wellFormedTree } from '../../../fixtures/folders';

const [mockTree] = wellFormedTree();
const [mockTreeThatViewersCanEdit] = treeViewersCanEdit();
const collator = new Intl.Collator();

// TODO: Generalise access control response and additional properties
const mockAccessControl = {
  'dashboards.permissions:write': true,
  'dashboards:create': true,
};
const additionalProperties = {
  canAdmin: true,
  canDelete: true,
  canEdit: true,
  canSave: true,
  created: '2025-07-14T12:07:36+02:00',
  createdBy: 'Anonymous',
  hasAcl: false,
  orgId: 1,
  updated: '2025-07-15T18:01:36+02:00',
  updatedBy: 'Anonymous',
  url: '/grafana/dashboards/f/1ca93012-1ffc-5d64-ae2e-54835c234c67/rik-cujahda-pi',
  version: 1,
};

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
        const random = Chance(folder.item.uid);
        return {
          id: random.integer({ min: 1, max: 1000 }),
          uid: folder.item.uid,
          title: folder.item.kind === 'folder' ? folder.item.title : "invalid - this shouldn't happen",
        };
      })
      .sort((a, b) => collator.compare(a.title, b.title)) // API always sorts by title
      .slice(limit * (page - 1), limit * page);

    return HttpResponse.json(folders);
  });

const getFolderHandler = () =>
  http.get('/api/folders/:uid', ({ params, request }) => {
    const { uid } = params;
    const url = new URL(request.url);
    const accessControlQueryParam = url.searchParams.get('accesscontrol');

    const folder = mockTree.find((v) => v.item.uid === uid);

    if (!folder) {
      return HttpResponse.json({ message: 'folder not found', status: 'not-found' }, { status: 404 });
    }

    const random = Chance(folder.item.uid);

    return HttpResponse.json({
      id: random.integer({ min: 1, max: 1000 }),
      title: folder?.item.title,
      uid: folder?.item.uid,
      ...additionalProperties,
      ...(accessControlQueryParam ? { accessControl: mockAccessControl } : {}),
    });
  });

const createFolderHandler = () =>
  http.post<never, { title: string; parentUid?: string }>('/api/folders', async ({ request }) => {
    const body = await request.json();
    if (!body || !body.title) {
      return HttpResponse.json({ message: 'folder title cannot be empty' }, { status: 400 });
    }
    const random = Chance(body.title);
    const uid = random.string({ length: 10 });
    const id = random.integer({ min: 1, max: 1000 });

    return HttpResponse.json({
      id,
      uid: uid,
      orgId: 1,
      title: body.title,
      url: `/dashboards/f/${uid}/${body.title}`,
      hasAcl: false,
      canSave: true,
      canEdit: true,
      canAdmin: true,
      canDelete: true,
      parentUid: body.parentUid,
      createdBy: 'admin',
      created: '2025-08-26T12:19:27+01:00',
      updatedBy: 'admin',
      updated: '2025-08-26T12:19:27+01:00',
      version: 1,
    });
  });

const handlers = [listFoldersHandler(), getFolderHandler(), createFolderHandler()];

export default handlers;

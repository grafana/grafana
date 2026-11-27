import { Chance } from 'chance';
import { HttpResponse, http } from 'msw';

import { wellFormedTree } from '../../../fixtures/folders';

const [mockTree] = wellFormedTree();

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

const getFolderByIdHandler = () =>
  http.get('/api/folders/id/:id', ({ params }) => {
    const id = Number(params.id);
    // ids aren't stored in the tree fixture, so derive them deterministically from the uid
    const folder = mockTree.find(
      (v) => v.item.kind === 'folder' && Chance(v.item.uid).integer({ min: 1, max: 1000 }) === id
    );

    if (!folder) {
      return HttpResponse.json({ message: 'folder not found', status: 'not-found' }, { status: 404 });
    }

    return HttpResponse.json({
      id,
      title: folder.item.title,
      uid: folder.item.uid,
      ...additionalProperties,
    });
  });

const handlers = [getFolderByIdHandler()];

export default handlers;

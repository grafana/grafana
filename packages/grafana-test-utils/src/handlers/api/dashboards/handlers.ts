import { HttpResponse, http } from 'msw';

import { wellFormedTree } from '../../../fixtures/folders';

const [mockTree] = wellFormedTree();

const getDashboardHandler = () =>
  http.get<{ uid: string }>('/api/dashboards/uid/:uid', ({ params }) => {
    const { uid } = params;
    const dashboard = mockTree.find((v) => v.item.uid === uid);

    if (!dashboard || dashboard.item.kind !== 'dashboard') {
      return HttpResponse.json({ message: 'Dashboard not found' }, { status: 404 });
    }

    const { item } = dashboard;

    const parentFolder = mockTree.find((v) => v.item.kind === 'folder' && v.item.uid === item.parentUID);

    return HttpResponse.json({
      meta: {
        folderTitle: parentFolder?.item.title,
        folderUid: parentFolder?.item.uid,
      },
      dashboard: {
        title: item.title,
        uid: item.uid,
      },
    });
  });

const handlers = [getDashboardHandler()];

export default handlers;

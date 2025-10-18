import { HttpResponse, http } from 'msw';

import { wellFormedTree } from '../../../fixtures/folders';

const [_, { folderA_dashbdD, dashbdD }] = wellFormedTree();

export const mockStarredDashboards = [dashbdD.item.uid, folderA_dashbdD.item.uid];

const getStarsHandler = () =>
  http.get('/api/user/stars', async () => {
    return HttpResponse.json(mockStarredDashboards);
  });

const deleteDashboardStarHandler = () =>
  http.delete('/api/user/stars/dashboard/uid/:uid', async () => {
    return HttpResponse.json({ message: 'Dashboard unstarred' });
  });

const addDashboardStarHandler = () =>
  http.post('/api/user/stars/dashboard/uid/:uid', async () => {
    return HttpResponse.json({ message: 'Dashboard starred!' });
  });

const handlers = [getStarsHandler(), deleteDashboardStarHandler(), addDashboardStarHandler()];

export default handlers;

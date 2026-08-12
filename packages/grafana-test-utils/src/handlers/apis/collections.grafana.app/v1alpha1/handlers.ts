import { HttpResponse, http } from 'msw';

import { mockStarredDashboardsMap, mockStarredFoldersMap } from '../../../../fixtures/starred';

// Maps a stars resource (keyed by `${group}/${kind}`) to the in-memory set backing it
const STARRED_RESOURCE_MAPS = {
  'dashboard.grafana.app/Dashboard': mockStarredDashboardsMap,
  'folder.grafana.app/Folder': mockStarredFoldersMap,
};

const getStarsMapFor = (group: string, kind: string) =>
  STARRED_RESOURCE_MAPS[`${group}/${kind}` as keyof typeof STARRED_RESOURCE_MAPS];

const getStarsHandler = () =>
  http.get('/apis/collections.grafana.app/v1alpha1/namespaces/:namespace/stars', () => {
    const mockStarsResponse = {
      kind: 'StarsList',
      apiVersion: 'collections.grafana.app/v1alpha1',
      metadata: {
        resourceVersion: '1758126936000',
      },
      items: [
        {
          metadata: {
            name: 'user-u000000001',
            namespace: 'default',
            resourceVersion: '1758126936000',
            creationTimestamp: '2025-05-14T14:02:10Z',
          },
          spec: {
            resource: Object.entries(STARRED_RESOURCE_MAPS).map(([key, map]) => {
              const [group, kind] = key.split('/');
              return { group, kind, names: Array.from(map.keys()) };
            }),
          },
          status: {},
        },
      ],
    };
    return HttpResponse.json(mockStarsResponse);
  });

const UPDATE_STARS_URL =
  '/apis/collections.grafana.app/v1alpha1/namespaces/:namespace/stars/:name/update/:group/:kind/:id';

type UpdateOrDeleteStarsParams = {
  namespace: string;
  name: string;
  group: string;
  kind: string;
  id: string;
};

const successResponse = {
  kind: 'Status',
  apiVersion: 'v1',
  metadata: {},
  code: 200,
};

const addStarHandler = () =>
  http.put<UpdateOrDeleteStarsParams>(UPDATE_STARS_URL, ({ params }) => {
    const { id, group, kind } = params;
    getStarsMapFor(group, kind).set(id, true);
    return HttpResponse.json(successResponse);
  });

const removeStarHandler = () =>
  http.delete<UpdateOrDeleteStarsParams>(UPDATE_STARS_URL, ({ params }) => {
    const { id, group, kind } = params;
    getStarsMapFor(group, kind).delete(id);
    return HttpResponse.json(successResponse);
  });

export default [getStarsHandler(), removeStarHandler(), addStarHandler()];

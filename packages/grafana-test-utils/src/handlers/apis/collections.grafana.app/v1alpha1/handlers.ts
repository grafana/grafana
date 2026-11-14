import { HttpResponse, http } from 'msw';

import { mockStarredDashboardsMap, mockStarredFoldersMap, mockStarredPluginKinds } from '../../../../fixtures/starred';

// Grafana's own kinds have fixed in-memory sets; any other group/kind is a plugin kind
const CORE_RESOURCE_MAPS: Record<string, Map<string, boolean>> = {
  'dashboard.grafana.app/Dashboard': mockStarredDashboardsMap,
  'folder.grafana.app/Folder': mockStarredFoldersMap,
};

// The Stars API accepts any group/kind, so a star of an unseen kind starts a new set
const getStarsMapFor = (group: string, kind: string) => {
  const key = `${group}/${kind}`;
  const core = CORE_RESOURCE_MAPS[key];
  if (core) {
    return core;
  }
  let map = mockStarredPluginKinds.get(key);
  if (!map) {
    map = new Map();
    mockStarredPluginKinds.set(key, map);
  }
  return map;
};

const starredResources = () =>
  [...Object.entries(CORE_RESOURCE_MAPS), ...mockStarredPluginKinds.entries()].map(([key, map]) => {
    const [group, kind] = key.split('/');
    return { group, kind, names: Array.from(map.keys()) };
  });

export const starsRoute = '/apis/collections.grafana.app/v1alpha1/namespaces/:namespace/stars';

const getStarsHandler = () =>
  http.get(starsRoute, () => {
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
            resource: starredResources(),
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

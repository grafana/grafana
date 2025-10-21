import { HttpResponse, http } from 'msw';

import { mockStarredDashboardsMap } from '../../../../fixtures/starred';

const getStarsHandler = () =>
  http.get('/apis/preferences.grafana.app/v1alpha1/namespaces/:namespace/stars', () => {
    const mockStarsResponse = {
      kind: 'StarsList',
      apiVersion: 'preferences.grafana.app/v1alpha1',
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
            resource: [
              {
                group: 'dashboard.grafana.app',
                kind: 'Dashboard',
                names: Array.from(mockStarredDashboardsMap.keys()),
              },
            ],
          },
          status: {},
        },
      ],
    };
    return HttpResponse.json(mockStarsResponse);
  });

const UPDATE_STARS_URL =
  '/apis/preferences.grafana.app/v1alpha1/namespaces/:namespace/stars/:name/update/:group/:kind/:id';

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
    const { id } = params;
    mockStarredDashboardsMap.set(id, true);
    return HttpResponse.json(successResponse);
  });

const removeStarHandler = () =>
  http.delete<UpdateOrDeleteStarsParams>(UPDATE_STARS_URL, ({ params }) => {
    const { id } = params;
    mockStarredDashboardsMap.delete(id);
    return HttpResponse.json(successResponse);
  });

export default [getStarsHandler(), removeStarHandler(), addStarHandler()];

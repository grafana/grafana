import { HttpResponse, http } from 'msw';

import { wellFormedTree } from '../../../../fixtures/folders';
import { getErrorResponse } from '../../../helpers';
const [mockTree] = wellFormedTree();

const dashboardsTree = mockTree.filter(({ item }) => item.kind === 'dashboard');

const dashboardToAppPlatform = (dashboard: (typeof mockTree)[number]['item']) => {
  return {
    kind: 'DashboardWithAccessInfo',
    apiVersion: 'dashboard.grafana.app/v1beta1',
    metadata: {
      name: dashboard.uid,
      namespace: 'default',
      uid: dashboard.uid,
      creationTimestamp: '2023-01-01T00:00:00Z',
      annotations: {
        // TODO: Eventually generalise annotations in fixture data, as required by tests
        'grafana.app/folder': dashboard.kind === 'dashboard' ? dashboard.parentUID : undefined,
      },
      labels: {},
    },
    spec: {
      title: dashboard.title,
      // TODO: Eventually add more fields to be more accurate to API response, as required by tests
    },
    status: {},
    // TODO: Eventually add access properties, as required by tests
  };
};

const getDashboardDto = () =>
  http.get<{ namespace: string; uid: string }>(
    '/apis/dashboard.grafana.app/v1beta1/namespaces/:namespace/dashboards/:uid/dto',
    ({ params }) => {
      const { uid } = params;

      const matchingDashboard = dashboardsTree.find(({ item }) => {
        return item.uid === uid;
      });

      if (!matchingDashboard) {
        return HttpResponse.json(getErrorResponse(`dashboards.dashboard.grafana.app "${uid}" not found`, 404), {
          status: 404,
        });
      }

      return HttpResponse.json(dashboardToAppPlatform(matchingDashboard.item));
    }
  );

export default [getDashboardDto()];

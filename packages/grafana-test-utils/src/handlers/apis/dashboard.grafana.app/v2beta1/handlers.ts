import { HttpResponse, http } from 'msw';

import { defaultSpec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { wellFormedTree } from '../../../../fixtures/folders';
import { getErrorResponse } from '../../../helpers';

const [mockTree] = wellFormedTree();

const dashboardsTree = mockTree.filter(({ item }) => item.kind === 'dashboard');

const dashboardToAppPlatform = (dashboard: (typeof mockTree)[number]['item']) => {
  return {
    kind: 'DashboardWithAccessInfo',
    apiVersion: 'dashboard.grafana.app/v2beta1',
    metadata: {
      name: dashboard.uid,
      namespace: 'default',
      uid: dashboard.uid,
      creationTimestamp: '2023-01-01T00:00:00Z',
      annotations: {
        'grafana.app/folder': dashboard.kind === 'dashboard' ? dashboard.parentUID : undefined,
      },
      labels: {},
    },
    spec: {
      ...defaultSpec(),
      title: dashboard.title,
    },
    status: {},
    access: {},
  };
};

const getDashboardDto = () =>
  http.get<{ namespace: string; uid: string }>(
    '/apis/dashboard.grafana.app/v2beta1/namespaces/:namespace/dashboards/:uid/dto',
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

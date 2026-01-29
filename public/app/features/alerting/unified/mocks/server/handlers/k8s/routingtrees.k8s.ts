import { HttpResponse, http } from 'msw';

import {
  deleteRoutingTree,
  getRoutingTree,
  getRoutingTreeList,
  resetDefaultRoutingTree,
  setRoutingTree,
} from 'app/features/alerting/unified/mocks/server/entities/k8s/routingtrees';
import { ALERTING_API_SERVER_BASE_URL } from 'app/features/alerting/unified/mocks/server/utils';
import {
  ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1RoutingTree,
  ListNamespacedRoutingTreeApiResponse,
} from 'app/features/alerting/unified/openapi/routesApi.gen';
import { ApiMachineryError } from 'app/features/alerting/unified/utils/k8s/errors';
import { ROOT_ROUTE_NAME } from '../../../../utils/k8s/constants';

const wrapRoutingTreeResponse: (
  routes: ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1RoutingTree[]
) => ListNamespacedRoutingTreeApiResponse = (routes) => ({
  kind: 'RoutingTree',
  metadata: {},
  items: routes,
});

const listNamespacedRoutingTreesHandler = () =>
  http.get<{ namespace: string }>(`${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/routingtrees`, () => {
    return HttpResponse.json(wrapRoutingTreeResponse(getRoutingTreeList()));
  });

const HTTP_RESPONSE_CONFLICT: ApiMachineryError = {
  kind: 'Status',
  apiVersion: 'v1',
  metadata: {},
  status: 'Failure',
  message: 'Conflict',
  reason: 'Conflict',
  details: {
    uid: 'alerting.notifications.conflict',
  },
  code: 409,
};

const updateNamespacedRoutingTreeHandler = () =>
  http.put<{ namespace: string; name: string }, ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1RoutingTree>(
    `${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/routingtrees/:name`,
    async ({ params: { name }, request }) => {
      const updatedRoutingTree = await request.json();
      const existingResourceVersion = getRoutingTree(name)?.metadata.resourceVersion;
      if (updatedRoutingTree.metadata.resourceVersion !== existingResourceVersion) {
        return HttpResponse.json(HTTP_RESPONSE_CONFLICT, { status: 409 });
      }
      setRoutingTree(name, updatedRoutingTree);
      return HttpResponse.json(updatedRoutingTree);
    }
  );

const getNamespacedRoutingTreeHandler = () =>
  http.get<{ namespace: string; name: string }>(
    `${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/routingtrees/:name`,
    ({ params: { name } }) => {
      const routingTree = getRoutingTree(name);
      if (!routingTree) {
        return HttpResponse.json({ message: 'NotFound' }, { status: 404 });
      }
      return HttpResponse.json(routingTree);
    }
  );

const createNamespacedRoutingTreeHandler = () =>
  http.post<
    { namespace: string; name: string },
    ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1RoutingTree
  >(`${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/routingtrees`, async ({ params: { name }, request }) => {
    const routingTree = await request.json();
    setRoutingTree(name, routingTree);
    return HttpResponse.json(routingTree);
  });

const deleteNamespacedRoutingTreeHandler = () =>
  http.delete<{ namespace: string; name: string }>(
    `${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/routingtrees/:name`,
    ({ params: { name } }) => {
      const routingTree = getRoutingTree(name);
      if (!routingTree) {
        return HttpResponse.json({ message: 'NotFound' }, { status: 404 });
      }
      if (name === ROOT_ROUTE_NAME) {
        // Reset instead.
        resetDefaultRoutingTree();
      } else {
        deleteRoutingTree(name);
      }
      return HttpResponse.json({});
    }
  );

const handlers = [
  listNamespacedRoutingTreesHandler(),
  updateNamespacedRoutingTreeHandler(),
  getNamespacedRoutingTreeHandler(),
  createNamespacedRoutingTreeHandler(),
  deleteNamespacedRoutingTreeHandler(),
];

export default handlers;

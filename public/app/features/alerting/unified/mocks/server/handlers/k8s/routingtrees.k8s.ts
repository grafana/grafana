import { HttpResponse, http } from 'msw';

import { RoutingTree, RoutingTreeList } from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';
import {
  deleteRoutingTree,
  getRoutingTree,
  getRoutingTreeList,
  resetDefaultRoutingTree,
  setRoutingTree,
} from 'app/features/alerting/unified/mocks/server/entities/k8s/routingtrees';
import { ALERTING_API_SERVER_BASE_URL } from 'app/features/alerting/unified/mocks/server/utils';
import { ApiMachineryError } from 'app/features/alerting/unified/utils/k8s/errors';

import { ROOT_ROUTE_NAME } from '../../../../utils/k8s/constants';

const wrapRoutingTreeResponse: (routes: RoutingTree[]) => RoutingTreeList = (routes) => ({
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
  http.put<{ namespace: string; name: string }, RoutingTree>(
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
  http.post<{ namespace: string }, RoutingTree>(
    `${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/routingtrees`,
    async ({ request }) => {
      const routingTree = (await request.json()) as RoutingTree;
      const name = routingTree.metadata?.name;
      if (!name) {
        return HttpResponse.json({ message: 'Route name is required' }, { status: 400 });
      }
      if (getRoutingTree(name)) {
        return HttpResponse.json(
          {
            ...HTTP_RESPONSE_CONFLICT,
            message: 'Route with this name already exists. Use a different name or update an existing one.',
          },
          { status: 409 }
        );
      }
      setRoutingTree(name, routingTree);
      return HttpResponse.json(routingTree);
    }
  );

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

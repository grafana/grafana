import { HttpResponse, http } from 'msw';

import { getRoutingTree, setRoutingTree } from 'app/features/alerting/unified/mocks/server/entities/k8s/routingtrees';
import { ALERTING_API_SERVER_BASE_URL } from 'app/features/alerting/unified/mocks/server/utils';
import {
  ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1RoutingTree,
  ListNamespacedRoutingTreeApiResponse,
} from 'app/features/alerting/unified/openapi/routesApi.gen';
import { ROOT_ROUTE_NAME } from 'app/features/alerting/unified/utils/k8s/constants';
import { ApiMachineryError } from 'app/features/alerting/unified/utils/k8s/errors';

const wrapRoutingTreeResponse: (
  route: ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1RoutingTree
) => ListNamespacedRoutingTreeApiResponse = (route) => ({
  kind: 'RoutingTree',
  metadata: {},
  items: [route],
});

const listNamespacedRoutingTreesHandler = () =>
  http.get<{ namespace: string }>(`${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/routingtrees`, () => {
    const userDefinedTree = getRoutingTree(ROOT_ROUTE_NAME)!;
    return HttpResponse.json(wrapRoutingTreeResponse(userDefinedTree));
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

const handlers = [listNamespacedRoutingTreesHandler(), updateNamespacedRoutingTreeHandler()];

export default handlers;

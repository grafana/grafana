import { HttpResponse, http } from 'msw';

import { ROUTING_TREE_MAP } from 'app/features/alerting/unified/mocks/server/entities/k8s/routingtrees';
import { ALERTING_API_SERVER_BASE_URL } from 'app/features/alerting/unified/mocks/server/utils';
import {
  ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1RoutingTree,
  ListNamespacedRoutingTreeApiResponse,
} from 'app/features/alerting/unified/openapi/routesApi.gen';

const wrapRoutingTreeResponse: (
  route: ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1RoutingTree
) => ListNamespacedRoutingTreeApiResponse = (route) => ({
  kind: 'RoutingTree',
  metadata: {},
  items: [route],
});

const listNamespacedRoutingTreesHandler = () =>
  http.get<{ namespace: string }>(`${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/routingtrees`, () => {
    const userDefinedTree = ROUTING_TREE_MAP.get('user-defined')!;
    return HttpResponse.json(wrapRoutingTreeResponse(userDefinedTree));
  });

const updateNamespacedRoutingTreeHandler = () =>
  http.put<{ namespace: string; name: string }, ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1RoutingTree>(
    `${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/routingtrees/:name`,
    async ({ params: { name }, request }) => {
      const updatedRoutingTree = await request.json();
      ROUTING_TREE_MAP.set(name, updatedRoutingTree);

      return HttpResponse.json(updatedRoutingTree);
    }
  );

const handlers = [listNamespacedRoutingTreesHandler(), updateNamespacedRoutingTreeHandler()];

export default handlers;

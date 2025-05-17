import { HttpResponse, http } from 'msw';

import {
  getAlertmanagerConfig,
  setAlertmanagerConfig,
} from 'app/features/alerting/unified/mocks/server/entities/alertmanagers';
import { ALERTING_API_SERVER_BASE_URL, getK8sResponse } from 'app/features/alerting/unified/mocks/server/utils';
import { ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1Receiver } from 'app/features/alerting/unified/openapi/receiversApi.gen';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { K8sAnnotations, PROVENANCE_NONE } from 'app/features/alerting/unified/utils/k8s/constants';

const usedByPolicies = ['grafana-default-email'];
const usedByRules = ['grafana-default-email'];
const cannotBeEdited = ['grafana-default-email'];
const cannotBeDeleted = ['grafana-default-email'];

const getReceiversList = () => {
  const config = getAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME);

  // Turn our mock alertmanager config into the format that we expect to be returned by the k8s API
  const mappedReceivers =
    config.alertmanager_config?.receivers?.map((contactPoint) => {
      const provenance =
        contactPoint.grafana_managed_receiver_configs?.find((integration) => {
          return integration.provenance;
        })?.provenance || PROVENANCE_NONE;
      return {
        metadata: {
          // This isn't exactly accurate, but its the cleanest way to use the same data for AM config and K8S responses
          uid: contactPoint.name,
          annotations: {
            [K8sAnnotations.Provenance]: provenance,
            [K8sAnnotations.AccessAdmin]: 'true',
            [K8sAnnotations.AccessDelete]: cannotBeDeleted.includes(contactPoint.name) ? 'false' : 'true',
            [K8sAnnotations.AccessWrite]: cannotBeEdited.includes(contactPoint.name) ? 'false' : 'true',
            [K8sAnnotations.InUseRoutes]: usedByPolicies.includes(contactPoint.name) ? '1' : '0',
            [K8sAnnotations.InUseRules]: usedByRules.includes(contactPoint.name) ? '1' : '0',
          },
        },
        spec: {
          title: contactPoint.name,
          integrations: contactPoint.grafana_managed_receiver_configs || [],
        },
      };
    }) || [];

  return getK8sResponse<ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1Receiver>(
    'ReceiverList',
    mappedReceivers
  );
};

const listNamespacedReceiverHandler = () =>
  http.get<{ namespace: string }>(`${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/receivers`, () => {
    return HttpResponse.json(getReceiversList());
  });

const getNamespacedReceiverHandler = () =>
  http.get<{ namespace: string; name: string }>(
    `${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/receivers/:name`,
    ({ params }) => {
      const { name } = params;
      const receivers = getReceiversList();
      const matchedReceiver = receivers.items.find((receiver) => receiver.metadata.uid === name);
      if (!matchedReceiver) {
        return HttpResponse.json({}, { status: 404 });
      }
      return HttpResponse.json(matchedReceiver);
    }
  );

const updateNamespacedReceiverHandler = () =>
  http.put<{ namespace: string; name: string }>(
    `${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/receivers/:name`,
    async ({ params, request }) => {
      // TODO: Make this update the internal config so API calls "persist"
      const { name } = params;
      const parsedReceivers = getReceiversList();
      const matchedReceiver = parsedReceivers.items.find((receiver) => receiver.metadata.uid === name);
      if (!matchedReceiver) {
        return HttpResponse.json({}, { status: 404 });
      }
      return HttpResponse.json(parsedReceivers);
    }
  );

const createNamespacedReceiverHandler = () =>
  http.post<{ namespace: string }>(
    `${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/receivers`,
    async ({ request }) => {
      const body = await request.clone().json();
      return HttpResponse.json(body);
    }
  );

const deleteNamespacedReceiverHandler = () =>
  http.delete<{ namespace: string; name: string }>(
    `${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/receivers/:name`,
    ({ params }) => {
      const { name } = params;
      const config = getAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME);
      const matchedReceiver = config.alertmanager_config?.receivers?.find((receiver) => receiver.name === name);
      if (!matchedReceiver) {
        return HttpResponse.json({}, { status: 404 });
      }

      const newConfig = config.alertmanager_config?.receivers?.filter((receiver) => receiver.name !== name);
      setAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME, {
        ...config,
        alertmanager_config: {
          ...config.alertmanager_config,
          receivers: newConfig,
        },
      });
      const parsedReceivers = getReceiversList();
      return HttpResponse.json(parsedReceivers);
    }
  );

const handlers = [
  listNamespacedReceiverHandler(),
  getNamespacedReceiverHandler(),
  updateNamespacedReceiverHandler(),
  createNamespacedReceiverHandler(),
  deleteNamespacedReceiverHandler(),
];
export default handlers;

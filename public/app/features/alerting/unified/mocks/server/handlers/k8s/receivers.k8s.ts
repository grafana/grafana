import { HttpResponse, http } from 'msw';

import { base64UrlEncode } from '@grafana/alerting';
import { API_GROUP, API_VERSION, type Receiver } from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';
import {
  getAlertmanagerConfig,
  setAlertmanagerConfig,
} from 'app/features/alerting/unified/mocks/server/entities/alertmanagers';
import { ALERTING_API_SERVER_BASE_URL, getK8sResponse } from 'app/features/alerting/unified/mocks/server/utils';
import { KnownProvenance } from 'app/features/alerting/unified/types/knownProvenance';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { K8sAnnotations } from 'app/features/alerting/unified/utils/k8s/constants';
import { receiverConfigToK8sIntegration } from 'app/features/alerting/unified/utils/k8s/utils';

const usedByPolicies = ['grafana-default-email'];
const usedByRules = ['grafana-default-email'];
const cannotBeEdited = ['grafana-default-email'];
const cannotBeDeleted = ['grafana-default-email'];

/** Parse `metadata.name=<value>` from a Kubernetes-style fieldSelector (single selector; value may be escaped). */
function parseMetadataNameFromFieldSelector(fieldSelector: string | null): string | undefined {
  if (!fieldSelector) {
    return undefined;
  }
  for (const part of fieldSelector.split(',')) {
    const trimmed = part.trim();
    const m = /^metadata\.name=(.+)$/.exec(trimmed);
    if (m) {
      return m[1].replace(/\\,/g, ',').replace(/\\=/g, '=').replace(/\\\\/g, '\\');
    }
  }
  return undefined;
}

/**
 * listReceiver fieldSelector may use plain `metadata.name` or base64url-encoded title
 * (see ContactPointSelector + notifications API); mock data uses plain names from alertmanager config.
 */
function receiverMetadataNameMatchesFieldSelector(
  receiverName: string | undefined,
  fieldSelectorName: string
): boolean {
  if (!receiverName) {
    return false;
  }
  if (receiverName === fieldSelectorName) {
    return true;
  }
  return base64UrlEncode(receiverName) === fieldSelectorName;
}

const getReceiversList = () => {
  const config = getAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME);

  // Turn our mock alertmanager config into the format that we expect to be returned by the k8s API
  const mappedReceivers =
    config.alertmanager_config?.receivers?.map((contactPoint) => {
      const provenance =
        contactPoint.grafana_managed_receiver_configs?.find((integration) => {
          return integration.provenance;
        })?.provenance || KnownProvenance.None;
      // Only receivers from Grafana configuration can be used (not imported ones)
      const canUse = provenance !== KnownProvenance.ConvertedPrometheus;
      return {
        apiVersion: `${API_GROUP}/${API_VERSION}`,
        kind: 'Receiver',
        metadata: {
          // Not exact K8s semantics; shared mock data for AM config and K8s list responses (`name` and `uid`).
          name: contactPoint.name,
          uid: contactPoint.name,
          annotations: {
            [K8sAnnotations.Provenance]: provenance,
            [K8sAnnotations.CanUse]: canUse ? 'true' : 'false',
            [K8sAnnotations.AccessAdmin]: 'true',
            [K8sAnnotations.AccessDelete]: cannotBeDeleted.includes(contactPoint.name) ? 'false' : 'true',
            [K8sAnnotations.AccessWrite]: cannotBeEdited.includes(contactPoint.name) ? 'false' : 'true',
            [K8sAnnotations.InUseRoutes]: usedByPolicies.includes(contactPoint.name) ? '1' : '0',
            [K8sAnnotations.InUseRules]: usedByRules.includes(contactPoint.name) ? '1' : '0',
          },
        },
        spec: {
          title: contactPoint.name,
          integrations: (contactPoint.grafana_managed_receiver_configs || []).map(receiverConfigToK8sIntegration),
        },
      };
    }) || [];

  return getK8sResponse<Receiver>('ReceiverList', mappedReceivers);
};

const listNamespacedReceiverHandler = () =>
  http.get<{ namespace: string }>(`${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/receivers`, ({ request }) => {
    const list = getReceiversList();
    const fieldSelector = new URL(request.url).searchParams.get('fieldSelector');
    const wantedName = parseMetadataNameFromFieldSelector(fieldSelector);
    if (wantedName !== undefined) {
      const filtered = list.items.filter((receiver) =>
        receiverMetadataNameMatchesFieldSelector(receiver.metadata?.name, wantedName)
      );
      return HttpResponse.json({ ...list, items: filtered });
    }
    return HttpResponse.json(list);
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

/**
 * This hook will combine data from both the Alertmanager config
 * and (if available) it will also fetch the status from the Grafana Managed status endpoint
 */

import { useMemo } from 'react';

import { receiversApi } from 'app/features/alerting/unified/api/receiversK8sApi';
import { useOnCallIntegration } from 'app/features/alerting/unified/components/receivers/grafanaAppReceivers/onCall/useOnCallIntegration';
import { ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1Receiver } from 'app/features/alerting/unified/openapi/receiversApi.gen';
import { BaseAlertmanagerArgs, Skippable } from 'app/features/alerting/unified/types/hooks';
import { cloudNotifierTypes } from 'app/features/alerting/unified/utils/cloud-alertmanager-notifier-types';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { isK8sEntityProvisioned, shouldUseK8sApi } from 'app/features/alerting/unified/utils/k8s/utils';
import { GrafanaManagedContactPoint, Receiver } from 'app/plugins/datasource/alertmanager/types';

import { getAPINamespace } from '../../../../../api/utils';
import { alertmanagerApi } from '../../api/alertmanagerApi';
import { onCallApi } from '../../api/onCallApi';
import { useAsync } from '../../hooks/useAsync';
import { usePluginBridge } from '../../hooks/usePluginBridge';
import { useProduceNewAlertmanagerConfiguration } from '../../hooks/useProduceNewAlertmanagerConfig';
import { addReceiverAction, deleteReceiverAction, updateReceiverAction } from '../../reducers/alertmanager/receivers';
import { getIrmIfPresentOrOnCallPluginId } from '../../utils/config';

import { enhanceContactPointsWithMetadata } from './utils';

const RECEIVER_STATUS_POLLING_INTERVAL = 10 * 1000; // 10 seconds

/**
 * This hook will combine data from several endpoints;
 * 1. the alertmanager config endpoint where the definition of the receivers are
 * 2. (if available) the alertmanager receiver status endpoint, currently Grafana Managed only
 * 3. (if available) additional metadata about Grafana Managed contact points
 * 4. (if available) the OnCall plugin metadata
 */

const {
  useGetAlertmanagerConfigurationQuery,
  useGetContactPointsStatusQuery,
  useGrafanaNotifiersQuery,
  useLazyGetAlertmanagerConfigurationQuery,
} = alertmanagerApi;
const { useGrafanaOnCallIntegrationsQuery } = onCallApi;
const {
  useListNamespacedReceiverQuery,
  useReadNamespacedReceiverQuery,
  useDeleteNamespacedReceiverMutation,
  useCreateNamespacedReceiverMutation,
  useReplaceNamespacedReceiverMutation,
} = receiversApi;

const defaultOptions = {
  refetchOnFocus: true,
  refetchOnReconnect: true,
};

/**
 * Check if OnCall is installed, and fetch the list of integrations if so.
 *
 * Otherwise, returns no data
 */
const useOnCallIntegrations = ({ skip }: Skippable = {}) => {
  const { installed, loading } = usePluginBridge(getIrmIfPresentOrOnCallPluginId());
  const oncallIntegrationsResponse = useGrafanaOnCallIntegrationsQuery(undefined, { skip: skip || !installed });

  return useMemo(() => {
    if (installed) {
      return oncallIntegrationsResponse;
    }
    return {
      isLoading: loading,
      data: undefined,
    };
  }, [installed, loading, oncallIntegrationsResponse]);
};

type K8sReceiver = ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1Receiver;

const parseK8sReceiver = (item: K8sReceiver): GrafanaManagedContactPoint => {
  return {
    id: item.metadata.name || item.metadata.uid || item.spec.title,
    name: item.spec.title,
    provisioned: isK8sEntityProvisioned(item),
    grafana_managed_receiver_configs: item.spec.integrations,
    metadata: item.metadata,
  };
};

const useK8sContactPoints = (...[hookParams, queryOptions]: Parameters<typeof useListNamespacedReceiverQuery>) => {
  return useListNamespacedReceiverQuery(hookParams, {
    ...queryOptions,
    selectFromResult: (result) => {
      const data = result.data?.items.map((item) => parseK8sReceiver(item));

      return {
        ...result,
        // K8S API will return 403 error for no-permissions case, so its cleaner to fallback to empty array
        data: result.error ? [] : data,
        currentData: data,
      };
    },
  });
};

type GrafanaFetchOptions = {
  /**
   * Should we fetch and include status information about each contact point?
   */
  fetchStatuses?: boolean;
  /**
   * Should we fetch and include the number of notification policies that reference each contact point?
   */
  fetchPolicies?: boolean;
};

/**
 * Fetch list of contact points from separate endpoint (i.e. not the Alertmanager config) and combine with
 * OnCall integrations and any additional metadata from list of notifiers
 * (e.g. hydrate with additional names/descriptions)
 */
export const useGrafanaContactPoints = ({
  fetchStatuses,
  fetchPolicies,
  skip,
}: GrafanaFetchOptions & Skippable = {}) => {
  const namespace = getAPINamespace();
  const potentiallySkip = { skip };
  const onCallResponse = useOnCallIntegrations(potentiallySkip);
  const alertNotifiers = useGrafanaNotifiersQuery(undefined, potentiallySkip);
  const contactPointsListResponse = useK8sContactPoints({ namespace }, potentiallySkip);

  const contactPointsStatusResponse = useGetContactPointsStatusQuery(undefined, {
    ...defaultOptions,
    pollingInterval: RECEIVER_STATUS_POLLING_INTERVAL,
    skip: skip || !fetchStatuses,
  });
  const alertmanagerConfigResponse = useGetAlertmanagerConfigurationQuery(GRAFANA_RULES_SOURCE_NAME, {
    skip: skip || !fetchPolicies,
  });

  return useMemo(() => {
    const isLoading = onCallResponse.isLoading || alertNotifiers.isLoading || contactPointsListResponse.isLoading;

    if (isLoading) {
      return {
        ...contactPointsListResponse,
        // If we're inside this block, it means that at least one of the endpoints we care about is still loading,
        // but the contactPointsListResponse may have in fact finished.
        // If we were to use _that_ loading state, it might be inaccurate elsewhere when consuming this hook,
        // so we explicitly say "yes, this is definitely still loading"
        isLoading: true,
        contactPoints: [],
      };
    }

    const enhanced = enhanceContactPointsWithMetadata({
      status: contactPointsStatusResponse.data,
      notifiers: alertNotifiers.data,
      onCallIntegrations: onCallResponse?.data,
      contactPoints: contactPointsListResponse.data || [],
      alertmanagerConfiguration: alertmanagerConfigResponse.data,
    });

    return {
      ...contactPointsListResponse,
      contactPoints: enhanced,
    };
  }, [
    alertNotifiers,
    alertmanagerConfigResponse,
    contactPointsListResponse,
    contactPointsStatusResponse,
    onCallResponse,
  ]);
};

/**
 * Fetch single contact point via the alertmanager config
 */
const useGetAlertmanagerContactPoint = (
  { alertmanager, name }: BaseAlertmanagerArgs & { name: string },
  queryOptions?: Parameters<typeof useGetAlertmanagerConfigurationQuery>[1]
) => {
  return useGetAlertmanagerConfigurationQuery(alertmanager, {
    ...queryOptions,
    selectFromResult: (result) => {
      const matchedContactPoint = result.data?.alertmanager_config.receivers?.find(
        (receiver) => receiver.name === name
      );
      return {
        ...result,
        data: matchedContactPoint,
        currentData: matchedContactPoint,
      };
    },
  });
};

/**
 * Fetch single contact point via the k8s API, or the alertmanager config
 */
const useGetGrafanaContactPoint = (
  { name }: { name: string },
  queryOptions?: Parameters<typeof useReadNamespacedReceiverQuery>[1]
) => {
  const namespace = getAPINamespace();

  return useReadNamespacedReceiverQuery(
    { namespace, name },
    {
      ...queryOptions,
      selectFromResult: (result) => {
        const data = result.data ? parseK8sReceiver(result.data) : undefined;
        return {
          ...result,
          data,
          currentData: data,
        };
      },
      skip: queryOptions?.skip,
    }
  );
};

export const useGetContactPoint = ({ alertmanager, name }: { alertmanager: string; name: string }) => {
  const isGrafana = alertmanager === GRAFANA_RULES_SOURCE_NAME;

  const grafanaResponse = useGetGrafanaContactPoint({ name }, { skip: !isGrafana });
  const alertmanagerResponse = useGetAlertmanagerContactPoint({ alertmanager, name }, { skip: isGrafana });

  return isGrafana ? grafanaResponse : alertmanagerResponse;
};

export function useContactPointsWithStatus({
  alertmanager,
  fetchStatuses,
  fetchPolicies,
  skip,
}: GrafanaFetchOptions & BaseAlertmanagerArgs & Skippable) {
  const isGrafanaAlertmanager = alertmanager === GRAFANA_RULES_SOURCE_NAME;
  const grafanaResponse = useGrafanaContactPoints({
    skip: skip || !isGrafanaAlertmanager,
    fetchStatuses,
    fetchPolicies,
  });

  const alertmanagerConfigResponse = useGetAlertmanagerConfigurationQuery(alertmanager, {
    ...defaultOptions,
    selectFromResult: (result) => ({
      ...result,
      contactPoints: result.data
        ? enhanceContactPointsWithMetadata({
            notifiers: cloudNotifierTypes,
            contactPoints: result.data.alertmanager_config.receivers ?? [],
            alertmanagerConfiguration: result.data,
          })
        : [],
    }),
    skip: skip || isGrafanaAlertmanager,
  });

  return isGrafanaAlertmanager ? grafanaResponse : alertmanagerConfigResponse;
}

type DeleteContactPointArgs = { name: string; resourceVersion?: string };
export function useDeleteContactPoint({ alertmanager }: BaseAlertmanagerArgs) {
  const useK8sApi = shouldUseK8sApi(alertmanager);

  const [produceNewAlertmanagerConfiguration] = useProduceNewAlertmanagerConfiguration();
  const [deleteReceiver] = useDeleteNamespacedReceiverMutation();

  const deleteFromK8sAPI = useAsync(async ({ name, resourceVersion }: DeleteContactPointArgs) => {
    const namespace = getAPINamespace();
    await deleteReceiver({
      name,
      namespace,
      ioK8SApimachineryPkgApisMetaV1DeleteOptions: { preconditions: { resourceVersion } },
    }).unwrap();
  });

  const deleteFromAlertmanagerConfiguration = useAsync(async ({ name }: DeleteContactPointArgs) => {
    const action = deleteReceiverAction(name);
    const result = await produceNewAlertmanagerConfiguration(action);

    return result;
  });

  return useK8sApi ? deleteFromK8sAPI : deleteFromAlertmanagerConfiguration;
}

const grafanaContactPointToK8sReceiver = (
  contactPoint: GrafanaManagedContactPoint,
  id?: string,
  resourceVersion?: string
): K8sReceiver => {
  return {
    metadata: {
      ...(id && { name: id }),
      resourceVersion,
    },
    spec: {
      title: contactPoint.name,
      integrations: contactPoint.grafana_managed_receiver_configs || [],
    },
  };
};

type ContactPointOperationArgs = {
  contactPoint: Receiver;
};

type CreateContactPointArgs = ContactPointOperationArgs;

export const useCreateContactPoint = ({ alertmanager }: BaseAlertmanagerArgs) => {
  const isGrafanaAlertmanager = alertmanager === GRAFANA_RULES_SOURCE_NAME;

  const { createOnCallIntegrations } = useOnCallIntegration();
  const [createGrafanaContactPoint] = useCreateNamespacedReceiverMutation();
  const [produceNewAlertmanagerConfiguration] = useProduceNewAlertmanagerConfiguration();

  const updateK8sAPI = useAsync(async ({ contactPoint }: CreateContactPointArgs) => {
    const contactPointWithMaybeOnCall = await createOnCallIntegrations(contactPoint);

    const namespace = getAPINamespace();
    const contactPointToUse = grafanaContactPointToK8sReceiver(contactPointWithMaybeOnCall);

    const result = await createGrafanaContactPoint({
      namespace,
      comGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1Receiver: contactPointToUse,
    }).unwrap();

    return result;
  });

  const updateAlertmanagerConfiguration = useAsync(async ({ contactPoint }: CreateContactPointArgs) => {
    const action = addReceiverAction(contactPoint);
    const result = await produceNewAlertmanagerConfiguration(action);

    return result;
  });

  return isGrafanaAlertmanager ? updateK8sAPI : updateAlertmanagerConfiguration;
};

type UpdateContactPointArgsK8s = ContactPointOperationArgs & {
  /** ID of existing contact point to update - used when updating via k8s API */
  id: string;
  resourceVersion?: string;
};
type UpdateContactPointArgsConfig = ContactPointOperationArgs & {
  /** Name of the existing contact point - used for checking uniqueness of name when not using k8s API*/
  originalName: string;
};
type UpdateContactpointArgs = UpdateContactPointArgsK8s | UpdateContactPointArgsConfig;

export const useUpdateContactPoint = ({ alertmanager }: BaseAlertmanagerArgs) => {
  const isGrafanaAlertmanager = alertmanager === GRAFANA_RULES_SOURCE_NAME;
  const useK8sApi = shouldUseK8sApi(alertmanager);

  const { createOnCallIntegrations } = useOnCallIntegration();
  const [replaceGrafanaContactPoint] = useReplaceNamespacedReceiverMutation();
  const [produceNewAlertmanagerConfiguration] = useProduceNewAlertmanagerConfiguration();

  const updateContactPoint = useAsync(async (args: UpdateContactpointArgs) => {
    if ('resourceVersion' in args && useK8sApi) {
      const { contactPoint, id, resourceVersion } = args;

      const receiverWithPotentialOnCall = isGrafanaAlertmanager
        ? await createOnCallIntegrations(contactPoint)
        : contactPoint;

      const namespace = getAPINamespace();
      const contactPointToUse = grafanaContactPointToK8sReceiver(receiverWithPotentialOnCall, id, resourceVersion);

      const result = await replaceGrafanaContactPoint({
        name: id,
        namespace,
        comGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1Receiver: contactPointToUse,
      }).unwrap();

      return result;
    } else if ('originalName' in args) {
      const { contactPoint, originalName } = args;
      const receiverWithPotentialOnCall = isGrafanaAlertmanager
        ? await createOnCallIntegrations(contactPoint)
        : contactPoint;

      const action = updateReceiverAction({ name: originalName, receiver: receiverWithPotentialOnCall });
      const result = await produceNewAlertmanagerConfiguration(action);

      return result;
    }
  });

  return updateContactPoint;
};

export const useValidateContactPoint = ({ alertmanager }: BaseAlertmanagerArgs) => {
  const [getConfig] = useLazyGetAlertmanagerConfigurationQuery();

  // If we're updating the Grafana AM entities,
  // then we let the API response handle the validation instead
  // as we don't expect to be able to fetch the contact points via the AM config
  if (alertmanager === GRAFANA_RULES_SOURCE_NAME) {
    return () => undefined;
  }

  return async (value: string, existingValue?: string) => {
    // If we've been given an existing value, and the name has not changed,
    // we can skip validation
    // (as we don't want to incorrectly flag the existing name as matching itself)
    if (existingValue && value === existingValue) {
      return;
    }
    return getConfig(alertmanager)
      .unwrap()
      .then((config) => {
        const { alertmanager_config } = config;
        const duplicated = Boolean(alertmanager_config.receivers?.find((contactPoint) => contactPoint.name === value));
        return duplicated ? `Contact point already exists with name "${value}"` : undefined;
      });
  };
};

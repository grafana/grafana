/**
 * This hook will combine data from both the Alertmanager config
 * and (if available) it will also fetch the status from the Grafana Managed status endpoint
 */

import { merge, set } from 'lodash';
import { useMemo } from 'react';

import { receiversApi } from 'app/features/alerting/unified/api/receiversK8sApi';
import { useOnCallIntegration } from 'app/features/alerting/unified/components/receivers/grafanaAppReceivers/onCall/useOnCallIntegration';
import { ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1Receiver } from 'app/features/alerting/unified/openapi/receiversApi.gen';
import { BaseAlertmanagerArgs, Skippable } from 'app/features/alerting/unified/types/hooks';
import { cloudNotifierTypes } from 'app/features/alerting/unified/utils/cloud-alertmanager-notifier-types';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import {
  getK8sNamespace,
  isK8sEntityProvisioned,
  shouldUseK8sApi,
} from 'app/features/alerting/unified/utils/k8s/utils';
import {
  GrafanaManagedContactPoint,
  GrafanaManagedReceiverConfig,
  Receiver,
} from 'app/plugins/datasource/alertmanager/types';

import { alertmanagerApi } from '../../api/alertmanagerApi';
import { onCallApi } from '../../api/onCallApi';
import { useAsync } from '../../hooks/useAsync';
import { usePluginBridge } from '../../hooks/usePluginBridge';
import { useProduceNewAlertmanagerConfiguration } from '../../hooks/useProduceNewAlertmanagerConfig';
import { addReceiverAction, deleteReceiverAction, updateReceiverAction } from '../../reducers/alertmanager/receivers';
import { SupportedPlugin } from '../../types/pluginBridges';

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
  useGetContactPointsListQuery,
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
  const { installed, loading } = usePluginBridge(SupportedPlugin.OnCall);
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

/**
 * Fetch contact points for Grafana Alertmanager, either from the k8s API,
 * or the `/notifications/receivers` endpoint
 */
const useFetchGrafanaContactPoints = ({ skip }: Skippable = {}) => {
  const namespace = getK8sNamespace();
  const useK8sApi = shouldUseK8sApi(GRAFANA_RULES_SOURCE_NAME);

  const grafanaResponse = useGetContactPointsListQuery(undefined, {
    skip: skip || useK8sApi,
    selectFromResult: (result) => {
      const data = result.data?.map((item) => ({
        ...item,
        provisioned: item.grafana_managed_receiver_configs?.some((item) => item.provenance),
      }));
      return {
        ...result,
        data,
        currentData: data,
      };
    },
  });
  const k8sResponse = useK8sContactPoints({ namespace }, { skip: skip || !useK8sApi });

  return useK8sApi ? k8sResponse : grafanaResponse;
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
  const potentiallySkip = { skip };
  const onCallResponse = useOnCallIntegrations(potentiallySkip);
  const alertNotifiers = useGrafanaNotifiersQuery(undefined, potentiallySkip);
  const contactPointsListResponse = useFetchGrafanaContactPoints(potentiallySkip);

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
  const namespace = getK8sNamespace();
  const useK8sApi = shouldUseK8sApi(GRAFANA_RULES_SOURCE_NAME);

  const k8sResponse = useReadNamespacedReceiverQuery(
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
      skip: queryOptions?.skip || !useK8sApi,
    }
  );

  const grafanaResponse = useGetAlertmanagerContactPoint(
    { alertmanager: GRAFANA_RULES_SOURCE_NAME, name },
    { skip: queryOptions?.skip || useK8sApi }
  );

  return useK8sApi ? k8sResponse : grafanaResponse;
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
    const namespace = getK8sNamespace();
    await deleteReceiver({
      name,
      namespace,
      ioK8SApimachineryPkgApisMetaV1DeleteOptions: { preconditions: { resourceVersion } },
    }).unwrap();
  });

  const deleteFromAlertmanagerConfiguration = useAsync(async ({ name }: DeleteContactPointArgs) => {
    const action = deleteReceiverAction(name);
    return produceNewAlertmanagerConfiguration(action);
  });

  return useK8sApi ? deleteFromK8sAPI : deleteFromAlertmanagerConfiguration;
}

/**
 * Turns a Grafana Managed receiver config into a format that can be sent to the k8s API
 *
 * When updating secure settings, we need to send a value of `true` for any secure setting that we want to keep the same.
 *
 * Any other setting that has a value in `secureSettings` will correspond to a new value for that setting -
 * so we should not tell the API that we want to preserve it. Those values will instead be sent within `settings`
 */
const mapIntegrationSettingsForK8s = (integration: GrafanaManagedReceiverConfig): GrafanaManagedReceiverConfig => {
  const { secureSettings, settings, ...restOfIntegration } = integration;
  const secureFields = Object.entries(secureSettings || {}).reduce((acc, [key, value]) => {
    // If a secure field has no (changed) value, then we tell the backend to persist it
    if (value === undefined) {
      return {
        ...acc,
        [key]: true,
      };
    }
    return acc;
  }, {});

  const mappedSecureSettings = Object.entries(secureSettings || {}).reduce((acc, [key, value]) => {
    // If the value is an empty string/falsy value, then we need to omit it from the payload
    // so the backend knows to remove it
    if (!value) {
      return acc;
    }

    // Otherwise, we send the value of the secure field
    return set(acc, key, value);
  }, {});

  // Merge settings properly with lodash so we don't lose any information from nested keys/secure settings
  const mergedSettings = merge({}, settings, mappedSecureSettings);

  return {
    ...restOfIntegration,
    secureFields,
    settings: mergedSettings,
  };
};
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
      integrations: (contactPoint.grafana_managed_receiver_configs || []).map(mapIntegrationSettingsForK8s),
    },
  };
};

type ContactPointOperationArgs = {
  contactPoint: Receiver;
};

type CreateContactPointArgs = ContactPointOperationArgs;

export const useCreateContactPoint = ({ alertmanager }: BaseAlertmanagerArgs) => {
  const isGrafanaAlertmanager = alertmanager === GRAFANA_RULES_SOURCE_NAME;
  const useK8sApi = shouldUseK8sApi(alertmanager);

  const { createOnCallIntegrations } = useOnCallIntegration();
  const [createGrafanaContactPoint] = useCreateNamespacedReceiverMutation();
  const [produceNewAlertmanagerConfiguration] = useProduceNewAlertmanagerConfiguration();

  const updateK8sAPI = useAsync(async ({ contactPoint }: CreateContactPointArgs) => {
    const contactPointWithMaybeOnCall = isGrafanaAlertmanager
      ? await createOnCallIntegrations(contactPoint)
      : contactPoint;

    const namespace = getK8sNamespace();
    const contactPointToUse = grafanaContactPointToK8sReceiver(contactPointWithMaybeOnCall);

    return createGrafanaContactPoint({
      namespace,
      comGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1Receiver: contactPointToUse,
    }).unwrap();
  });

  const updateAlertmanagerConfiguration = useAsync(async ({ contactPoint }: CreateContactPointArgs) => {
    const contactPointWithMaybeOnCall = isGrafanaAlertmanager
      ? await createOnCallIntegrations(contactPoint)
      : contactPoint;

    const action = addReceiverAction(contactPointWithMaybeOnCall);
    return produceNewAlertmanagerConfiguration(action);
  });

  return useK8sApi ? updateK8sAPI : updateAlertmanagerConfiguration;
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

      const namespace = getK8sNamespace();
      const contactPointToUse = grafanaContactPointToK8sReceiver(receiverWithPotentialOnCall, id, resourceVersion);

      return replaceGrafanaContactPoint({
        name: id,
        namespace,
        comGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1Receiver: contactPointToUse,
      }).unwrap();
    } else if ('originalName' in args) {
      const { contactPoint, originalName } = args;
      const receiverWithPotentialOnCall = isGrafanaAlertmanager
        ? await createOnCallIntegrations(contactPoint)
        : contactPoint;

      const action = updateReceiverAction({ name: originalName, receiver: receiverWithPotentialOnCall });
      return produceNewAlertmanagerConfiguration(action);
    }
  });

  return updateContactPoint;
};

export const useValidateContactPoint = ({ alertmanager }: BaseAlertmanagerArgs) => {
  const useK8sApi = shouldUseK8sApi(alertmanager);

  const [getConfig] = useLazyGetAlertmanagerConfigurationQuery();

  // If we're using the kubernetes API, then we let the API response handle the validation instead
  // as we don't expect to be able to fetch the intervals via the AM config
  if (useK8sApi) {
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

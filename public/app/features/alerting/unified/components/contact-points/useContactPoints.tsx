/**
 * This hook will combine data from both the Alertmanager config
 * and (if available) it will also fetch the status from the Grafana Managed status endpoint
 */

import { produce } from 'immer';
import { remove } from 'lodash';
import { useMemo } from 'react';

import { alertingApi } from 'app/features/alerting/unified/api/alertingApi';
import { useOnCallIntegration } from 'app/features/alerting/unified/components/receivers/grafanaAppReceivers/onCall/useOnCallIntegration';
import {
  ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1Receiver,
  generatedReceiversApi,
} from 'app/features/alerting/unified/openapi/receiversApi.gen';
import { updateAlertManagerConfigAction } from 'app/features/alerting/unified/state/actions';
import { BaseAlertmanagerArgs, Skippable } from 'app/features/alerting/unified/types/hooks';
import { cloudNotifierTypes } from 'app/features/alerting/unified/utils/cloud-alertmanager-notifier-types';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import {
  getK8sNamespace,
  isK8sEntityProvisioned,
  shouldUseK8sApi,
} from 'app/features/alerting/unified/utils/k8s/utils';
import { updateConfigWithReceiver } from 'app/features/alerting/unified/utils/receiver-form';
import { GrafanaManagedContactPoint, Receiver } from 'app/plugins/datasource/alertmanager/types';
import { useDispatch } from 'app/types';

import { alertmanagerApi } from '../../api/alertmanagerApi';
import { onCallApi } from '../../api/onCallApi';
import { usePluginBridge } from '../../hooks/usePluginBridge';
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
  useUpdateAlertmanagerConfigurationMutation,
} = alertmanagerApi;
const { useGrafanaOnCallIntegrationsQuery } = onCallApi;
const {
  useListNamespacedReceiverQuery,
  useReadNamespacedReceiverQuery,
  useDeleteNamespacedReceiverMutation,
  useCreateNamespacedReceiverMutation,
  useReplaceNamespacedReceiverMutation,
} = generatedReceiversApi;

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
    id: item.metadata.uid,
    name: item.spec.title,
    provisioned: isK8sEntityProvisioned(item),
    grafana_managed_receiver_configs: item.spec.integrations,
  };
};

const useK8sContactPoints = (...[hookParams, queryOptions]: Parameters<typeof useListNamespacedReceiverQuery>) => {
  return useListNamespacedReceiverQuery(hookParams, {
    ...queryOptions,
    selectFromResult: ({ data, ...rest }) => {
      return {
        ...rest,
        data: data?.items.map((item) => parseK8sReceiver(item)),
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
      return {
        ...result,
        data: result.data?.map((item) => ({
          ...item,
          provisioned: item.grafana_managed_receiver_configs?.some((item) => item.provenance),
        })),
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

    if (isLoading || !contactPointsListResponse.data) {
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
      contactPoints: contactPointsListResponse.data,
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
        (receiver) => decodeURIComponent(receiver.name) === decodeURIComponent(name)
      );
      return {
        ...result,
        data: matchedContactPoint,
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
      selectFromResult: (result) => ({
        ...result,
        data: result.data ? parseK8sReceiver(result.data) : undefined,
      }),
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
}: GrafanaFetchOptions & BaseAlertmanagerArgs) {
  const isGrafanaAlertmanager = alertmanager === GRAFANA_RULES_SOURCE_NAME;
  const grafanaResponse = useGrafanaContactPoints({
    skip: !isGrafanaAlertmanager,
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
    skip: isGrafanaAlertmanager,
  });

  return isGrafanaAlertmanager ? grafanaResponse : alertmanagerConfigResponse;
}

export function useDeleteContactPoint({ alertmanager }: BaseAlertmanagerArgs) {
  const [fetchAlertmanagerConfig] = useLazyGetAlertmanagerConfigurationQuery();
  const [updateAlertManager] = useUpdateAlertmanagerConfigurationMutation();
  const [deleteReceiver] = useDeleteNamespacedReceiverMutation();

  const useK8sApi = shouldUseK8sApi(alertmanager);

  if (useK8sApi) {
    return async ({ name }: { name: string }) => {
      const namespace = getK8sNamespace();
      return deleteReceiver({
        name,
        namespace,
        ioK8SApimachineryPkgApisMetaV1DeleteOptions: {},
      }).unwrap();
    };
  }

  return async ({ name }: { name: string }) => {
    return fetchAlertmanagerConfig(alertmanager).then(({ data }) => {
      if (!data) {
        return;
      }

      const newConfig = produce(data, (draft) => {
        remove(draft?.alertmanager_config?.receivers ?? [], (receiver) => receiver.name === name);
        return draft;
      });

      return updateAlertManager({
        selectedAlertmanager: alertmanager,
        config: newConfig,
      }).unwrap();
    });
  };
}

type ContactPointCreateUpdateArgs = {
  contactPoint: Receiver;
};

type CreateOrUpdateArgs = ContactPointCreateUpdateArgs & { id?: string; originalName?: string };

const grafanaContactPointToK8sReceiver = (contactPoint: GrafanaManagedContactPoint, id?: string): K8sReceiver => {
  return {
    ...(id && {
      metadata: {
        name: id,
      },
    }),
    spec: {
      title: contactPoint.name,
      integrations: contactPoint.grafana_managed_receiver_configs || [],
    },
  };
};

export const useCreateOrUpdateContactPoint = ({ alertmanager }: BaseAlertmanagerArgs) => {
  const isGrafanaAlertmanager = alertmanager === GRAFANA_RULES_SOURCE_NAME;
  const { createOnCallIntegrations } = useOnCallIntegration();
  const useK8sApi = shouldUseK8sApi(alertmanager);

  const dispatch = useDispatch();
  const [getAlertmanagerConfig] = useLazyGetAlertmanagerConfigurationQuery();
  const [replaceGrafanaContactPoint] = useReplaceNamespacedReceiverMutation();
  const [createGrafanaContactPoint] = useCreateNamespacedReceiverMutation();
  if (useK8sApi) {
    // If we have an original name, then we're updating existing
    return async ({ contactPoint, originalName, id }: CreateOrUpdateArgs) => {
      const namespace = getK8sNamespace();
      const contactPointToUse = grafanaContactPointToK8sReceiver(contactPoint, id);
      if (!id) {
        return createGrafanaContactPoint({
          namespace,
          comGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1Receiver: contactPointToUse,
        }).unwrap();
      }

      if (originalName) {
        return replaceGrafanaContactPoint({
          name: id,
          namespace,
          comGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1Receiver: contactPointToUse,
        }).unwrap();
      }

      return;
    };
  }

  return async ({ contactPoint, originalName }: CreateOrUpdateArgs) => {
    const receiverWithPotentialOnCall = isGrafanaAlertmanager
      ? await createOnCallIntegrations(contactPoint)
      : contactPoint;
    const config = await getAlertmanagerConfig(alertmanager).unwrap();
    const newConfig = updateConfigWithReceiver(config, receiverWithPotentialOnCall, originalName);

    await dispatch(
      updateAlertManagerConfigAction({
        newConfig: newConfig,
        oldConfig: config,
        alertManagerSourceName: alertmanager,
      })
    ).then(() => {
      dispatch(alertingApi.util.invalidateTags(['AlertmanagerConfiguration', 'ContactPoint', 'ContactPointsStatus']));
      dispatch(generatedReceiversApi.util.invalidateTags(['Receiver']));
    });
  };
};

export const useValidateContactPoint = ({ alertmanager }: BaseAlertmanagerArgs) => {
  const useK8sApi = shouldUseK8sApi(alertmanager);

  const [getConfig] = useLazyGetAlertmanagerConfigurationQuery();

  // If we're using the kubernetes API, then we let the API response handle the validation instead
  // as we don't expect to be able to fetch the intervals via the AM config
  if (useK8sApi) {
    return () => undefined;
  }

  return async (value: string, skipValidation?: boolean) => {
    if (skipValidation) {
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

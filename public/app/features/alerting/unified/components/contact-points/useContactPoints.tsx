/**
 * This hook will combine data from both the Alertmanager config
 * and (if available) it will also fetch the status from the Grafana Managed status endpoint
 */

import { produce } from 'immer';
import { remove } from 'lodash';
import { useMemo } from 'react';

import {
  ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1Receiver,
  generatedReceiversApi,
} from 'app/features/alerting/unified/openapi/receiversApi.gen';
import { cloudNotifierTypes } from 'app/features/alerting/unified/utils/cloud-alertmanager-notifier-types';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { getNamespace, shouldUseK8sApi } from 'app/features/alerting/unified/utils/k8s/utils';

import { alertmanagerApi } from '../../api/alertmanagerApi';
import { onCallApi } from '../../api/onCallApi';
import { usePluginBridge } from '../../hooks/usePluginBridge';
import { useAlertmanager } from '../../state/AlertmanagerContext';
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
const { useListNamespacedReceiverQuery } = generatedReceiversApi;

const defaultOptions = {
  refetchOnFocus: true,
  refetchOnReconnect: true,
};

/**
 * Check if OnCall is installed, and fetch the list of integrations if so.
 *
 * Otherwise, returns no data
 */
const useOnCallIntegrations = ({ skip }: { skip?: boolean } = {}) => {
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

// TODO: Make this typed as returning `GrafanaManagedContactPoint` - we can't yet do this as the schema thinks
// its returning integration settings as a `string` rather than `Record<string, any>`
const parseK8sReceiver = (item: K8sReceiver) => {
  return { name: item.spec.title, grafana_managed_receiver_configs: item.spec.integrations };
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

const useGetGrafanaContactPoints = ({ skip }: { skip?: boolean } = {}) => {
  const namespace = getNamespace();
  const useK8sApi = shouldUseK8sApi(GRAFANA_RULES_SOURCE_NAME);
  const grafanaResponse = useGetContactPointsListQuery(undefined, { skip: skip || useK8sApi });
  const k8sResponse = useK8sContactPoints({ namespace }, { skip: skip || !useK8sApi });

  return useK8sApi ? k8sResponse : grafanaResponse;
};

/**
 * Fetch contact points from separate endpoint (i.e. not the Alertmanager config) and combine with
 * OnCall integrations and any additional metadata from list of notifiers
 * (e.g. hydrate with additional names/descriptions)
 */
export const useGrafanaContactPoints = ({
  fetchStatuses,
  fetchPolicies,
  skip,
}: {
  /**
   * Should we fetch and include status information about each contact point?
   */
  fetchStatuses?: boolean;
  /**
   * Should we fetch and include the number of notification policies that reference each contact point?
   */
  fetchPolicies?: boolean;
  /**
   * Should we skip requests altogether?
   * Useful for cases where we want to conditionally call grafana or external alertmanager endpoints
   */
  skip?: boolean;
} = {}) => {
  const onCallResponse = useOnCallIntegrations({ skip });
  const alertNotifiers = useGrafanaNotifiersQuery(undefined, { skip });
  const contactPointsListResponse = useGetGrafanaContactPoints({ skip });
  const contactPointsStatusResponse = useGetContactPointsStatusQuery(undefined, {
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

export function useContactPointsWithStatus() {
  const { selectedAlertmanager, isGrafanaAlertmanager } = useAlertmanager();

  const grafanaResponse = useGrafanaContactPoints({
    skip: !isGrafanaAlertmanager,
    fetchStatuses: true,
    fetchPolicies: true,
  });

  const alertmanagerConfigResponse = useGetAlertmanagerConfigurationQuery(selectedAlertmanager!, {
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

  return isGrafanaAlertmanager
    ? {
        error: grafanaResponse.error,
        isLoading: grafanaResponse.isLoading,
        contactPoints: grafanaResponse.contactPoints,
      }
    : {
        error: alertmanagerConfigResponse.error,
        isLoading: alertmanagerConfigResponse.isLoading,
        contactPoints: alertmanagerConfigResponse.contactPoints,
      };
}

export function useDeleteContactPoint(selectedAlertmanager: string) {
  const [fetchAlertmanagerConfig] = useLazyGetAlertmanagerConfigurationQuery();
  const [updateAlertManager, updateAlertmanagerState] = useUpdateAlertmanagerConfigurationMutation();

  const deleteTrigger = (contactPointName: string) => {
    return fetchAlertmanagerConfig(selectedAlertmanager).then(({ data }) => {
      if (!data) {
        return;
      }

      const newConfig = produce(data, (draft) => {
        remove(draft?.alertmanager_config?.receivers ?? [], (receiver) => receiver.name === contactPointName);
        return draft;
      });

      return updateAlertManager({
        selectedAlertmanager,
        config: newConfig,
      }).unwrap();
    });
  };

  return {
    deleteTrigger,
    updateAlertmanagerState,
  };
}

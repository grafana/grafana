/**
 * This hook will combine data from both the Alertmanager config
 * and (if available) it will also fetch the status from the Grafana Managed status endpoint
 */

import { produce } from 'immer';
import { remove } from 'lodash';
import { useMemo } from 'react';

import { alertmanagerApi } from '../../api/alertmanagerApi';
import { onCallApi } from '../../api/onCallApi';
import { usePluginBridge } from '../../hooks/usePluginBridge';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { SupportedPlugin } from '../../types/pluginBridges';

import { enhanceContactPointsWithMetadata } from './utils';

export const RECEIVER_STATUS_KEY = Symbol('receiver_status');
export const RECEIVER_META_KEY = Symbol('receiver_metadata');
export const RECEIVER_PLUGIN_META_KEY = Symbol('receiver_plugin_metadata');

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

/**
 * Fetch contact points from separate endpoint (i.e. not the Alertmanager config) and combine with
 * OnCall integrations and any additional metadata from list of notifiers
 * (e.g. hydrate with additional names/descriptions)
 */
export const useGetContactPoints = () => {
  const onCallResponse = useOnCallIntegrations();
  const alertNotifiers = useGrafanaNotifiersQuery();
  const contactPointsListResponse = useGetContactPointsListQuery();

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

    const enhanced = enhanceContactPointsWithMetadata(
      [],
      alertNotifiers.data,
      onCallResponse?.data,
      contactPointsListResponse.data,
      undefined
    );

    return {
      ...contactPointsListResponse,
      contactPoints: enhanced,
    };
  }, [
    alertNotifiers.data,
    alertNotifiers.isLoading,
    contactPointsListResponse,
    onCallResponse?.data,
    onCallResponse.isLoading,
  ]);
};

export function useContactPointsWithStatus() {
  const { selectedAlertmanager, isGrafanaAlertmanager } = useAlertmanager();

  const defaultOptions = {
    refetchOnFocus: true,
    refetchOnReconnect: true,
  };

  // fetch receiver status if we're dealing with a Grafana Managed Alertmanager
  const fetchContactPointsStatus = useGetContactPointsStatusQuery(undefined, {
    ...defaultOptions,
    // re-fetch status every so often for up-to-date information
    pollingInterval: RECEIVER_STATUS_POLLING_INTERVAL,
    // skip fetching receiver statuses if not Grafana AM
    skip: !isGrafanaAlertmanager,
  });

  // fetch notifier metadata from the Grafana API if we're using a Grafana AM – this will be used to add additional
  // metadata and canonical names to the receiver
  const fetchReceiverMetadata = useGrafanaNotifiersQuery(undefined, {
    skip: !isGrafanaAlertmanager,
  });

  // if the OnCall plugin is installed, fetch its list of integrations so we can match those to the Grafana Managed contact points
  const { data: onCallMetadata, isLoading: onCallPluginIntegrationsLoading } = useOnCallIntegrations({
    skip: !isGrafanaAlertmanager,
  });

  // fetch the latest config from the Alertmanager
  // we use this endpoint only when we need to get the number of policies
  const fetchAlertmanagerConfiguration = useGetAlertmanagerConfigurationQuery(selectedAlertmanager!, {
    ...defaultOptions,
    selectFromResult: (result) => ({
      ...result,
      contactPoints: result.data
        ? enhanceContactPointsWithMetadata(
            fetchContactPointsStatus.data,
            fetchReceiverMetadata.data,
            onCallMetadata,
            result.data.alertmanager_config.receivers ?? [],
            result.data
          )
        : [],
    }),
  });

  // we will fail silently for fetching OnCall plugin status and integrations
  const error = fetchAlertmanagerConfiguration.error || fetchContactPointsStatus.error;
  const isLoading =
    fetchAlertmanagerConfiguration.isLoading || fetchContactPointsStatus.isLoading || onCallPluginIntegrationsLoading;

  return {
    error,
    isLoading,
    contactPoints: fetchAlertmanagerConfiguration.contactPoints,
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

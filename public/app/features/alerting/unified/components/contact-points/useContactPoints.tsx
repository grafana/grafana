/**
 * This hook will combine data from both the Alertmanager config
 * and (if available) it will also fetch the status from the Grafana Managed status endpoint
 */

import { remove } from 'lodash';

import { alertmanagerApi } from '../../api/alertmanagerApi';
import { onCallApi, OnCallIntegrationDTO } from '../../api/onCallApi';
import { usePluginBridge } from '../../hooks/usePluginBridge';
import { useProduceNewAlertmanagerConfiguration } from '../../hooks/useProduceNewAlertmanagerConfig';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { SupportedPlugin } from '../../types/pluginBridges';
import { CloudChannelValues, ReceiverFormValues } from '../../types/receiver-form';
import { formValuesToCloudReceiver, renameReceiverInRoute } from '../../utils/receiver-form';
import { defaultChannelValues } from '../receivers/form/CloudReceiverForm';

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
interface UseContactPointsWithStatusOptions {
  includePoliciesCount: boolean;
  receiverStatusPollingInterval?: number;
}

const defaultHookOptions = {
  includePoliciesCount: true,
  receiverStatusPollingInterval: RECEIVER_STATUS_POLLING_INTERVAL,
};

export function useContactPointsWithStatus({
  includePoliciesCount,
  receiverStatusPollingInterval,
}: UseContactPointsWithStatusOptions = defaultHookOptions) {
  const { selectedAlertmanager, isGrafanaAlertmanager } = useAlertmanager();
  const { installed: onCallPluginInstalled, loading: onCallPluginStatusLoading } = usePluginBridge(
    SupportedPlugin.OnCall
  );

  // fetch receiver status if we're dealing with a Grafana Managed Alertmanager
  const fetchContactPointsStatus = alertmanagerApi.endpoints.getContactPointsStatus.useQuery(undefined, {
    refetchOnFocus: true,
    refetchOnReconnect: true,
    // re-fetch status every so often for up-to-date information, allow disabling by passing "receiverStatusPollingInterval: 0"
    pollingInterval: receiverStatusPollingInterval,
    // skip fetching receiver statuses if not Grafana AM
    skip: !isGrafanaAlertmanager,
  });

  // fetch notifier metadata from the Grafana API if we're using a Grafana AM – this will be used to add additional
  // metadata and canonical names to the receiver
  const fetchReceiverMetadata = alertmanagerApi.endpoints.grafanaNotifiers.useQuery(undefined, {
    skip: !isGrafanaAlertmanager,
  });

  // if the OnCall plugin is installed, fetch its list of integrations so we can match those to the Grafana Managed contact points
  const { data: onCallIntegrations, isLoading: onCallPluginIntegrationsLoading } =
    onCallApi.endpoints.grafanaOnCallIntegrations.useQuery(undefined, {
      skip: !onCallPluginInstalled || !isGrafanaAlertmanager,
    });

  // null = no installed, undefined = loading, [n] is installed with integrations
  let onCallMetadata: null | undefined | OnCallIntegrationDTO[] = undefined;
  if (onCallPluginInstalled) {
    onCallMetadata = onCallIntegrations ?? [];
  } else if (onCallPluginInstalled === false) {
    onCallMetadata = null;
  }

  // fetch the latest config from the Alertmanager
  // we use this endpoint only when we need to get the number of policies
  const fetchAlertmanagerConfiguration = alertmanagerApi.endpoints.getAlertmanagerConfiguration.useQuery(
    selectedAlertmanager!,
    {
      refetchOnFocus: true,
      refetchOnReconnect: true,
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
      skip: !includePoliciesCount,
    }
  );

  // for Grafana Managed Alertmanager, we use the new read-only endpoint for getting the list of contact points
  const fetchGrafanaContactPoints = alertmanagerApi.endpoints.getContactPointsList.useQuery(undefined, {
    refetchOnFocus: true,
    refetchOnReconnect: true,
    selectFromResult: (result) => ({
      ...result,
      contactPoints: result.data
        ? enhanceContactPointsWithMetadata(
            fetchContactPointsStatus.data,
            fetchReceiverMetadata.data,
            onCallMetadata,
            result.data, // contact points from the new readonly endpoint
            undefined //no config data
          )
        : [],
    }),
    skip: includePoliciesCount || !isGrafanaAlertmanager,
  });

  // we will fail silently for fetching OnCall plugin status and integrations
  const error =
    fetchAlertmanagerConfiguration.error || fetchGrafanaContactPoints.error || fetchContactPointsStatus.error;
  const isLoading =
    fetchAlertmanagerConfiguration.isLoading ||
    fetchGrafanaContactPoints.isLoading ||
    fetchContactPointsStatus.isLoading ||
    onCallPluginStatusLoading ||
    onCallPluginIntegrationsLoading;

  const unsortedContactPoints = includePoliciesCount
    ? fetchAlertmanagerConfiguration.contactPoints
    : fetchGrafanaContactPoints.contactPoints;
  const contactPoints = unsortedContactPoints.sort((a, b) => a.name.localeCompare(b.name));
  return {
    error,
    isLoading,
    contactPoints,
    refetchReceivers: fetchGrafanaContactPoints.refetch,
  };
}

export function useDeleteContactPoint() {
  const [produceNewConfig, updateState] = useProduceNewAlertmanagerConfiguration();

  const deleteFn = async (contactPointName: string) => {
    await produceNewConfig((draft) => {
      remove(draft.alertmanager_config.receivers ?? [], (receiver) => receiver.name === contactPointName);
      return draft;
    });
  };

  return [deleteFn, updateState] as const;
}

export function useUpsertCloudContactPoint() {
  const [produceNewConfig, updateState] = useProduceNewAlertmanagerConfiguration();

  const upsertFn = async (formValues: ReceiverFormValues<CloudChannelValues>, existingReceiverName?: string) => {
    const newReceiver = formValuesToCloudReceiver(formValues, defaultChannelValues);

    await produceNewConfig((draft) => {
      let currentReceivers = draft.alertmanager_config.receivers ?? [];
      let currentRoute = draft.alertmanager_config.route;

      const creating = !existingReceiverName;
      const updating = Boolean(existingReceiverName);
      const renaming = updating && newReceiver.name !== existingReceiverName;

      const oldTargetIndex = currentReceivers.findIndex((receiver) => receiver.name === existingReceiverName);
      const oldTargetExists = oldTargetIndex > -1;

      const newTargetIndex = currentReceivers.findIndex((receiver) => receiver.name === newReceiver.name);
      const newTargetExists = newTargetIndex > -1;

      // sanity checks for updating / creating / renaming receivers
      if ((creating || renaming) && newTargetExists) {
        throw new Error(`Duplicate receiver name ${newReceiver.name}`);
      } else if (updating && !renaming && !oldTargetExists) {
        throw new Error(`Expected receiver ${existingReceiverName} to exist, but did not find it in the config`);
      }

      // we are either updating (or renaming) an existing receiver or adding a new one
      if (updating) {
        currentReceivers[oldTargetIndex] = newReceiver;
      } else if (creating) {
        currentReceivers.push(newReceiver);
      }

      // if receiver was renamed, rename it in routes as well
      // technically we don't have to check for "existingReceiverName" but TypeScript is not able to infer that it can't be undefined
      if (currentRoute && renaming && existingReceiverName) {
        draft.alertmanager_config.route = renameReceiverInRoute(currentRoute, existingReceiverName, newReceiver.name);
      }
    });
  };

  return [upsertFn, updateState] as const;
}

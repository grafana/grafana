/**
 * This hook will combine data from both the Alertmanager config
 * and (if available) it will also fetch the status from the Grafana Managed status endpoint
 */

import {
  AlertManagerCortexConfig,
  GrafanaManagedReceiverConfig,
  Receiver,
} from 'app/plugins/datasource/alertmanager/types';
import { NotifierStatus, ReceiversStateDTO } from 'app/types';

import { alertmanagerApi } from '../../api/alertmanagerApi';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';

export const RECEIVER_STATUS_KEY = Symbol('receiver_status');
const RECEIVER_STATUS_POLLING_INTERVAL = 10 * 1000; // 10 seconds

// Grafana Managed contact points have receivers with additional diagnostics
interface ReceiverConfigWithStatus extends GrafanaManagedReceiverConfig {
  // we're using a symbol here so we'll never have a conflict on keys for a receiver
  // we also specify that the diagnostics might be "undefined" for vanilla Alertmanager
  [RECEIVER_STATUS_KEY]?: NotifierStatus | undefined;
}

interface ContactPointsWithStatus extends Receiver {
  grafana_managed_receiver_configs: ReceiverConfigWithStatus[];
}

/**
 * This hook will combine data from two endpoints;
 * 1. the alertmanager config endpoint where the definitation of the receivers lives
 * 2. (if available) the alertmanager receiver status endpoint, currently Grafana Managed only
 */
export function useContactPoints(selectedAlertmanager: string) {
  const isGrafanaManagedAlertmanager = selectedAlertmanager === GRAFANA_RULES_SOURCE_NAME;

  // fetch receiver status if we're dealing with a Grafana Managed Alertmanager
  const fetchContactPointsDiagnostics = alertmanagerApi.useGetReceiversDiagnosticsQuery(undefined, {
    refetchOnFocus: true,
    pollingInterval: RECEIVER_STATUS_POLLING_INTERVAL, // re-fetch status every so often
    skip: !isGrafanaManagedAlertmanager, // skip if not Grafana AM
  });

  // fetch the latest config from the Alertmanager
  const fetchAlertmanagerConfiguration = alertmanagerApi.useGetAlertmanagerConfigurationQuery(selectedAlertmanager, {
    refetchOnFocus: true,
    selectFromResult: (result) => ({
      ...result,
      contactPoints: result.data ? enhanceContactPointsWithStatus(result.data, fetchContactPointsDiagnostics.data) : [],
    }),
  });

  // TODO kinda yucky to combine hooks like this, better alternative?
  const error = fetchAlertmanagerConfiguration.error ?? fetchContactPointsDiagnostics.error;
  const isLoading = fetchAlertmanagerConfiguration.isLoading || fetchContactPointsDiagnostics.isLoading;

  const contactPoints: ContactPointsWithStatus[] = fetchAlertmanagerConfiguration.contactPoints;

  return {
    error,
    isLoading,
    contactPoints,
  };
}

/**
 * This function adds the status information for each of the integrations (contact point types) in a contact point
 * 1. we iterate over all contact points
 * 2. for each contact point we "enhance" it with the status or "undefined" for vanilla Alertmanager
 */
function enhanceContactPointsWithStatus(
  result: AlertManagerCortexConfig,
  status: ReceiversStateDTO[] = []
): ContactPointsWithStatus[] {
  const contactPoints = result.alertmanager_config.receivers ?? [];

  return contactPoints.map((contactPoint) => {
    const receivers = contactPoint.grafana_managed_receiver_configs ?? [];
    const statusForReceiver = status.find((status) => status.name === contactPoint.name);

    return {
      ...contactPoint,
      grafana_managed_receiver_configs: receivers.map((receiver, index) => ({
        ...receiver,
        [RECEIVER_STATUS_KEY]: statusForReceiver?.integrations[index],
      })),
    };
  });
}

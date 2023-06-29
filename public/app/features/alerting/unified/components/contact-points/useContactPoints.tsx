/**
 * This hook will combine data from both the Alertmanager config
 * and (if available) it will also fetch the status from the Grafana Managed status endpoint
 */

import produce from 'immer';
import { remove } from 'lodash';

import { alertmanagerApi } from '../../api/alertmanagerApi';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';

import { ContactPointWithStatus, enhanceContactPointsWithStatus, fingerprintAlertmanagerConfig } from './utils';

export const RECEIVER_STATUS_KEY = Symbol('receiver_status');
const RECEIVER_STATUS_POLLING_INTERVAL = 10 * 1000; // 10 seconds

/**
 * This hook will combine data from two endpoints;
 * 1. the alertmanager config endpoint where the definition of the receivers are
 * 2. (if available) the alertmanager receiver status endpoint, currently Grafana Managed only
 */
export function useContactPointsWithStatus(selectedAlertmanager: string) {
  const isGrafanaManagedAlertmanager = selectedAlertmanager === GRAFANA_RULES_SOURCE_NAME;

  // fetch receiver status if we're dealing with a Grafana Managed Alertmanager
  const fetchContactPointsStatus = alertmanagerApi.endpoints.getContactPointsStatus.useQuery(undefined, {
    // TODO these don't seem to work since we've not called setupListeners()
    refetchOnFocus: true,
    refetchOnReconnect: true,
    // re-fetch status every so often for up-to-date information
    pollingInterval: RECEIVER_STATUS_POLLING_INTERVAL,
    // skip fetching receiver statuses if not Grafana AM
    skip: !isGrafanaManagedAlertmanager,
  });

  // fetch the latest config from the Alertmanager
  const fetchAlertmanagerConfiguration = alertmanagerApi.useGetAlertmanagerConfigurationQuery(selectedAlertmanager, {
    refetchOnFocus: true,
    selectFromResult: (result) => ({
      ...result,
      contactPoints: result.data ? enhanceContactPointsWithStatus(result.data, fetchContactPointsStatus.data) : [],
    }),
  });

  // TODO kinda yucky to combine hooks like this, better alternative?
  const error = fetchAlertmanagerConfiguration.error ?? fetchContactPointsStatus.error;
  const isLoading = fetchAlertmanagerConfiguration.isLoading || fetchContactPointsStatus.isLoading;

  const contactPoints: ContactPointWithStatus[] = fetchAlertmanagerConfiguration.contactPoints;

  return {
    error,
    isLoading,
    contactPoints,
  };
}

// TODO add the check back in to detect of someone else had already made changes to the config file...
//
// maybe we can use the cached value of the endpoint? That way we can compare the hash of the file between invocation
// of this hook and when we call "deleteTrigger" 🤔
// this seems to work but there _has_ to be something better – maybe middleware?
export function useDeleteContactPoint(selectedAlertmanager: string) {
  const fetchAlertmanagerConfig = alertmanagerApi.endpoints.getAlertmanagerConfiguration.useQuery(selectedAlertmanager);
  const [updateAlertManager, updateAlertmanagerState] =
    alertmanagerApi.endpoints.updateAlertmanagerConfiguration.useMutation();

  const deleteTrigger = (contactPointName: string) => {
    return fetchAlertmanagerConfig.refetch().then(({ data }) => {
      if (!data) {
        return;
      }

      if (fingerprintAlertmanagerConfig(data) !== fingerprintAlertmanagerConfig(fetchAlertmanagerConfig.data)) {
        throw new Error('someone mutated config');
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

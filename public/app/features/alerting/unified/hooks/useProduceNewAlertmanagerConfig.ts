import { Action } from '@reduxjs/toolkit';

import { alertmanagerApi } from '../api/alertmanagerApi';
import { alertmanagerConfigurationReducer } from '../reducers/alertmanagerConfiguration/receivers';
import { useAlertmanager } from '../state/AlertmanagerContext';

const ERR_NO_ACTIVE_AM = new Error('no active Alertmanager');

/**
 * This hook will make sure we are always applying actions that mutate the Alertmanager configuration
 * on top of the latest Alertmanager configuration object.
 */
export function useProduceNewAlertmanagerConfiguration() {
  const { selectedAlertmanager } = useAlertmanager();
  const [fetchAlertmanagerConfig, _fetchAlertmanagerState] =
    alertmanagerApi.endpoints.getAlertmanagerConfiguration.useLazyQuery();

  const [updateAlertManager, updateAlertmanagerState] =
    alertmanagerApi.endpoints.updateAlertmanagerConfiguration.useMutation();

  if (!selectedAlertmanager) {
    throw ERR_NO_ACTIVE_AM;
  }

  const produceNewAlertmanagerConfiguration = async (action: Action) => {
    const currentAlertmanagerConfiguration = await fetchAlertmanagerConfig(selectedAlertmanager).unwrap();
    const newConfig = alertmanagerConfigurationReducer(currentAlertmanagerConfiguration, action);

    return updateAlertManager({
      selectedAlertmanager,
      config: newConfig,
    }).unwrap();
  };

  // @TODO merge loading state with the fetching state
  return [produceNewAlertmanagerConfiguration, updateAlertmanagerState] as const;
}

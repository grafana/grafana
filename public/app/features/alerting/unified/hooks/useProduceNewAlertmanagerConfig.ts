import { Action } from '@reduxjs/toolkit';

import { alertmanagerApi } from '../api/alertmanagerApi';
import { muteTimingsReducer } from '../reducers/alertmanager/muteTimings';
import { useAlertmanager } from '../state/AlertmanagerContext';

import { mergeRequestStates } from './mergeRequestStates';

const ERR_NO_ACTIVE_AM = new Error('no active Alertmanager');

const { useLazyGetAlertmanagerConfigurationQuery, useUpdateAlertmanagerConfigurationMutation } = alertmanagerApi;

/**
 * This hook will make sure we are always applying actions that mutate the Alertmanager configuration
 * on top of the latest Alertmanager configuration object.
 */
export function useProduceNewAlertmanagerConfiguration() {
  const { selectedAlertmanager } = useAlertmanager();

  const [fetchAlertmanagerConfig, fetchAlertmanagerState] = useLazyGetAlertmanagerConfigurationQuery();
  const [updateAlertManager, updateAlertmanagerState] = useUpdateAlertmanagerConfigurationMutation();

  const newConfigurationState = mergeRequestStates(fetchAlertmanagerState, updateAlertmanagerState);

  if (!selectedAlertmanager) {
    throw ERR_NO_ACTIVE_AM;
  }

  /**
   * This function will fetch the latest Alertmanager configuration, apply a diff to it via a reducer and
   * returns the result.
   *
   * ┌────────────────────────────┐  ┌───────────────┐  ┌───────────────────┐
   * │ fetch latest configuration │─▶│ apply reducer │─▶│  new rule config  │
   * └────────────────────────────┘  └───────────────┘  └───────────────────┘
   */
  const produceNewAlertmanagerConfiguration = async (action: Action) => {
    const currentAlertmanagerConfiguration = await fetchAlertmanagerConfig(selectedAlertmanager).unwrap();
    const newConfig = muteTimingsReducer(currentAlertmanagerConfiguration, action);

    return updateAlertManager({
      selectedAlertmanager,
      config: newConfig,
    }).unwrap();
  };

  return [produceNewAlertmanagerConfiguration, newConfigurationState] as const;
}

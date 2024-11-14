import { Action } from '@reduxjs/toolkit';
import reduceReducers from 'reduce-reducers';

import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';

import { alertmanagerApi } from '../api/alertmanagerApi';
import { muteTimingsReducer } from '../reducers/alertmanager/muteTimings';
import { notificationTemplatesReducer } from '../reducers/alertmanager/notificationTemplates';
import { receiversReducer } from '../reducers/alertmanager/receivers';
import { useAlertmanager } from '../state/AlertmanagerContext';

import { mergeRequestStates } from './mergeRequestStates';

const ERR_NO_ACTIVE_AM = new Error('no active Alertmanager');

const { useLazyGetAlertmanagerConfigurationQuery, useUpdateAlertmanagerConfigurationMutation } = alertmanagerApi;

export const initialAlertmanagerConfiguration: AlertManagerCortexConfig = {
  alertmanager_config: {
    receivers: [],
    route: {},
    time_intervals: [],
    mute_time_intervals: [],
    inhibit_rules: [],
    templates: [],
  },
  template_files: {},
};

const configurationReducer = reduceReducers(
  initialAlertmanagerConfiguration,
  muteTimingsReducer,
  receiversReducer,
  notificationTemplatesReducer
);

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

    const newConfig = configurationReducer(currentAlertmanagerConfiguration, action);

    return updateAlertManager({
      selectedAlertmanager,
      config: newConfig,
    }).unwrap();
  };

  return [produceNewAlertmanagerConfiguration, newConfigurationState] as const;
}

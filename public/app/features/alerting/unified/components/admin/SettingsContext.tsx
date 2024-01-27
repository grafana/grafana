import { union, without } from 'lodash';
import React, { PropsWithChildren } from 'react';

import { AlertmanagerChoice, ExternalAlertmanagerConfig } from 'app/plugins/datasource/alertmanager/types';

import { alertmanagerApi } from '../../api/alertmanagerApi';
import { dataSourcesApi } from '../../api/dataSourcesApi';
import {
  ExternalAlertmanagerDataSourceWithStatus,
  useExternalDataSourceAlertmanagers,
} from '../../hooks/useExternalAmSelector';
import { GRAFANA_RULES_SOURCE_NAME, isAlertmanagerDataSourceInterestedInAlerts } from '../../utils/datasource';

const USING_INTERNAL_ALERTMANAGER_SETTINGS = [AlertmanagerChoice.Internal, AlertmanagerChoice.All];

interface Context {
  deliverySettings?: ExternalAlertmanagerConfig;
  externalAlertmanagers: ExternalAlertmanagerDataSourceWithStatus[];
  isLoading: boolean;
  isUpdating: boolean;
  enableAlertmanager: (uid: string) => void;
  disableAlertmanager: (uid: string) => void;
}

const SettingsContext = React.createContext<Context | undefined>(undefined);
const isInternalAlertmanager = (uid: string) => uid === GRAFANA_RULES_SOURCE_NAME;

export const SettingsProvider = (props: PropsWithChildren) => {
  // this list will keep track of Alertmanager UIDs (including internal) that are interested in receiving alert instances
  // this will be used to infer the correct "delivery mode" and update the correct list of datasources with "wantsAlertsReceived"
  let interestedAlertmanagers: string[] = [];

  const { currentData: deliverySettings, isLoading: isLoadingDeliverySettings } =
    alertmanagerApi.endpoints.getExternalAlertmanagerConfig.useQuery();

  const [updateDeliverySettings, updateDeliverySettingsState] =
    alertmanagerApi.endpoints.saveExternalAlertmanagersConfig.useMutation();
  const [updateAlertmanagerDataSource, updateAlertmanagerDataSourceState] =
    dataSourcesApi.endpoints.updateAlertmanagerReceiveSetting.useMutation();

  const externalAlertmanagers = useExternalDataSourceAlertmanagers();

  const interstedInternal = USING_INTERNAL_ALERTMANAGER_SETTINGS.some(
    (choice) => deliverySettings?.alertmanagersChoice === choice
  );
  if (interstedInternal) {
    interestedAlertmanagers.push(GRAFANA_RULES_SOURCE_NAME);
  }

  const interestedExternal = externalAlertmanagers.filter((alertmanager) =>
    isAlertmanagerDataSourceInterestedInAlerts(alertmanager.dataSourceSettings)
  );
  interestedExternal.forEach((alertmanager) => {
    interestedAlertmanagers.push(alertmanager.dataSourceSettings.uid);
  });

  const enableAlertmanager = (uid: string) => {
    const updatedInterestedAlertmanagers = union([uid], interestedAlertmanagers); // union will give us a unique array of uids
    const newDeliveryMode = determineDeliveryMode(updatedInterestedAlertmanagers);

    if (newDeliveryMode !== deliverySettings?.alertmanagersChoice) {
      updateDeliverySettings({ alertmanagersChoice: newDeliveryMode });
    }

    if (!isInternalAlertmanager(uid)) {
      updateAlertmanagerDataSource({ uid, handleGrafanaManagedAlerts: true });
    }
  };

  const disableAlertmanager = (uid: string) => {
    const updatedInterestedAlertmanagers = without(interestedAlertmanagers, uid);
    const newDeliveryMode = determineDeliveryMode(updatedInterestedAlertmanagers);

    if (newDeliveryMode !== deliverySettings?.alertmanagersChoice) {
      updateDeliverySettings({ alertmanagersChoice: newDeliveryMode });
    }

    if (!isInternalAlertmanager(uid)) {
      updateAlertmanagerDataSource({ uid, handleGrafanaManagedAlerts: false });
    }
  };

  const value: Context = {
    deliverySettings,
    externalAlertmanagers,
    enableAlertmanager,
    disableAlertmanager,
    isLoading: isLoadingDeliverySettings,
    isUpdating: updateDeliverySettingsState.isLoading || updateAlertmanagerDataSourceState.isLoading,
  };

  return <SettingsContext.Provider value={value}>{props.children}</SettingsContext.Provider>;
};

function determineDeliveryMode(interestedAlertmanagers: string[]): AlertmanagerChoice {
  const containsInternalAlertmanager = interestedAlertmanagers.some((uid) => uid === GRAFANA_RULES_SOURCE_NAME);
  const containsExternalAlertmanager = interestedAlertmanagers.some((uid) => uid !== GRAFANA_RULES_SOURCE_NAME);

  if (containsInternalAlertmanager && containsExternalAlertmanager) {
    return AlertmanagerChoice.All;
  }

  if (!containsInternalAlertmanager && containsExternalAlertmanager) {
    return AlertmanagerChoice.External;
  }

  if (containsInternalAlertmanager && !containsExternalAlertmanager) {
    return AlertmanagerChoice.Internal;
  }

  // if we get here we probably have no targets at all and that's not supposed to be possible.
  throw new Error('No interested Alertmanager targets found, illegal configuration');
}

export function useSettings() {
  const context = React.useContext(SettingsContext);

  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsContext');
  }

  return context;
}

import { union, without, debounce } from 'lodash';
import React, { PropsWithChildren, useEffect, useRef } from 'react';

import { AlertmanagerChoice, ExternalAlertmanagerConfig } from 'app/plugins/datasource/alertmanager/types';
import { dispatch } from 'app/store/store';

import { alertmanagerApi } from '../../api/alertmanagerApi';
import { dataSourcesApi, enableOrDisableHandlingGrafanaManagedAlerts } from '../../api/dataSourcesApi';
import {
  ExternalAlertmanagerDataSourceWithStatus,
  useExternalDataSourceAlertmanagers,
} from '../../hooks/useExternalAmSelector';
import { deleteAlertManagerConfigAction, updateAlertManagerConfigAction } from '../../state/actions';
import { GRAFANA_RULES_SOURCE_NAME, isAlertmanagerDataSourceInterestedInAlerts } from '../../utils/datasource';

const USING_INTERNAL_ALERTMANAGER_SETTINGS = [AlertmanagerChoice.Internal, AlertmanagerChoice.All];

interface Context {
  deliverySettings?: ExternalAlertmanagerConfig;
  externalAlertmanagerDataSourcesWithStatus: ExternalAlertmanagerDataSourceWithStatus[];

  isLoading: boolean;
  isUpdating: boolean;

  // for enabling / disabling Alertmanager datasources as additional receivers
  enableAlertmanager: (uid: string) => void;
  disableAlertmanager: (uid: string) => void;

  // for updating or resetting the configuration for an Alertmanager
  updateAlertmanagerSettings: (name: string, oldConfig: string, newConfig: string) => void;
  resetAlertmanagerSettings: (name: string) => void;
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
  const [enableGrafanaManagedAlerts, enableOrDisableHandlingGrafanaManagedAlertsState] =
    enableOrDisableHandlingGrafanaManagedAlerts();

  const externalAlertmanagersWithStatus = useExternalDataSourceAlertmanagers();

  const interestedInternal = USING_INTERNAL_ALERTMANAGER_SETTINGS.some(
    (choice) => deliverySettings?.alertmanagersChoice === choice
  );
  if (interestedInternal) {
    interestedAlertmanagers.push(GRAFANA_RULES_SOURCE_NAME);
  }

  externalAlertmanagersWithStatus
    .filter((dataSource) => isAlertmanagerDataSourceInterestedInAlerts(dataSource.dataSourceSettings))
    .forEach((alertmanager) => {
      interestedAlertmanagers.push(alertmanager.dataSourceSettings.uid);
    });

  const enableAlertmanager = (uid: string) => {
    const updatedInterestedAlertmanagers = union([uid], interestedAlertmanagers); // union will give us a unique array of uids
    const newDeliveryMode = determineDeliveryMode(updatedInterestedAlertmanagers);

    if (newDeliveryMode !== deliverySettings?.alertmanagersChoice) {
      updateDeliverySettings({ alertmanagersChoice: newDeliveryMode });
    }

    if (!isInternalAlertmanager(uid)) {
      enableGrafanaManagedAlerts(uid, true);
    }
  };

  const disableAlertmanager = (uid: string) => {
    const updatedInterestedAlertmanagers = without(interestedAlertmanagers, uid);
    const newDeliveryMode = determineDeliveryMode(updatedInterestedAlertmanagers);

    if (newDeliveryMode !== deliverySettings?.alertmanagersChoice) {
      updateDeliverySettings({ alertmanagersChoice: newDeliveryMode });
    }

    if (!isInternalAlertmanager(uid)) {
      enableGrafanaManagedAlerts(uid, false);
    }
  };

  const updateAlertmanagerSettings = (alertManagerName: string, oldConfig: string, newConfig: string): void => {
    dispatch(
      updateAlertManagerConfigAction({
        newConfig: JSON.parse(newConfig),
        oldConfig: JSON.parse(oldConfig),
        alertManagerSourceName: alertManagerName,
        successMessage: 'Alertmanager configuration updated.',
      })
    );
  };

  const resetAlertmanagerSettings = (alertmanagerName: string) => {
    dispatch(deleteAlertManagerConfigAction(alertmanagerName));
  };

  const value: Context = {
    deliverySettings,
    externalAlertmanagerDataSourcesWithStatus: externalAlertmanagersWithStatus,
    enableAlertmanager,
    disableAlertmanager,
    isLoading: isLoadingDeliverySettings,
    isUpdating: updateDeliverySettingsState.isLoading || enableOrDisableHandlingGrafanaManagedAlertsState.isLoading,

    // CRUD for Alertmanager settings
    updateAlertmanagerSettings,
    resetAlertmanagerSettings,
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
  // @TODO we're currently not handling this error and we should show the user that they need at least 1 target.
  throw new Error('No interested Alertmanager targets found, illegal configuration');
}

export function useSettings() {
  const context = React.useContext(SettingsContext);

  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsContext');
  }

  // we'll automatically re-fetch the Alertmanager connection status while any Alertmanagers are pending by invalidating the cache entry
  const debouncedUpdateStatus = debounce(() => {
    dispatch(dataSourcesApi.util.invalidateTags(['AlertmanagerConnectionStatus']));
  }, 3000);
  const refetchAlertmanagerConnectionStatus = useRef(debouncedUpdateStatus);

  const hasPendingAlertmanagers = context.externalAlertmanagerDataSourcesWithStatus.some(
    ({ status }) => status === 'pending'
  );
  if (hasPendingAlertmanagers) {
    refetchAlertmanagerConnectionStatus.current();
  }

  useEffect(() => {
    debouncedUpdateStatus.cancel();
  }, [debouncedUpdateStatus]);

  return context;
}

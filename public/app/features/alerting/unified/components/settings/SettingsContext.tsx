import { debounce, union, without } from 'lodash';
import { PropsWithChildren, createContext, useContext, useEffect, useRef } from 'react';

import { AppEvents } from '@grafana/data';
import { config, getAppEvents } from '@grafana/runtime';
import { AlertmanagerChoice, GrafanaAlertingConfiguration } from 'app/plugins/datasource/alertmanager/types';
import { dispatch } from 'app/store/store';

import { alertmanagerApi } from '../../api/alertmanagerApi';
import { dataSourcesApi } from '../../api/dataSourcesApi';
import {
  ExternalAlertmanagerDataSourceWithStatus,
  useExternalDataSourceAlertmanagers,
} from '../../hooks/useExternalAmSelector';
import { deleteAlertManagerConfigAction, updateAlertManagerConfigAction } from '../../state/actions';
import { GRAFANA_RULES_SOURCE_NAME, isAlertmanagerDataSourceInterestedInAlerts } from '../../utils/datasource';
import { isInternalAlertmanagerInterestedInAlerts } from '../../utils/settings';

import { useEnableOrDisableHandlingGrafanaManagedAlerts } from './hooks';

const appEvents = getAppEvents();

interface Context {
  configuration?: GrafanaAlertingConfiguration;
  externalAlertmanagerDataSourcesWithStatus: ExternalAlertmanagerDataSourceWithStatus[];

  isLoading: boolean;
  isUpdating: boolean;

  // for enabling / disabling Alertmanager datasources as additional receivers
  enableAlertmanager: (uid: string) => void;
  disableAlertmanager: (uid: string) => void;

  // for updating or resetting the configuration for an Alertmanager
  updateAlertmanagerSettings: (name: string, oldConfig: string, newConfig: string) => void;
  resetAlertmanagerSettings: (name: string) => void;

  // this feature toggle is for disabling the "send to external Alertmanagers" feature
  forwardingDisabled: boolean;
}

const SettingsContext = createContext<Context | undefined>(undefined);
const isInternalAlertmanager = (uid: string) => uid === GRAFANA_RULES_SOURCE_NAME;

export const SettingsProvider = (props: PropsWithChildren) => {
  // this list will keep track of Alertmanager UIDs (including internal) that are interested in receiving alert instances
  // this will be used to infer the correct "delivery mode" and update the correct list of datasources with "wantsAlertsReceived"
  const interestedAlertmanagers: string[] = [];

  const forwardingDisabled = config.featureToggles.alertingDisableSendAlertsExternal === true;

  const { currentData: configuration, isLoading: isLoadingConfiguration } =
    alertmanagerApi.endpoints.getGrafanaAlertingConfiguration.useQuery();

  const [updateConfiguration, updateConfigurationState] =
    alertmanagerApi.endpoints.updateGrafanaAlertingConfiguration.useMutation();
  const [enableGrafanaManagedAlerts, disableGrafanaManagedAlerts, enableOrDisableHandlingGrafanaManagedAlertsState] =
    useEnableOrDisableHandlingGrafanaManagedAlerts();

  // we will alwayw refetch because a user could edit a data source and come back to this page
  const externalAlertmanagersWithStatus = useExternalDataSourceAlertmanagers({ refetchOnMountOrArgChange: true });

  const interestedInternal = isInternalAlertmanagerInterestedInAlerts(configuration);
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
    if (newDeliveryMode === null) {
      return;
    }

    if (newDeliveryMode !== configuration?.alertmanagersChoice) {
      updateConfiguration({ alertmanagersChoice: newDeliveryMode });
    }

    if (!isInternalAlertmanager(uid)) {
      enableGrafanaManagedAlerts(uid);
    }
  };

  const disableAlertmanager = (uid: string) => {
    const updatedInterestedAlertmanagers = without(interestedAlertmanagers, uid);
    const newDeliveryMode = determineDeliveryMode(updatedInterestedAlertmanagers);
    if (newDeliveryMode === null) {
      return;
    }

    if (newDeliveryMode !== configuration?.alertmanagersChoice) {
      updateConfiguration({ alertmanagersChoice: newDeliveryMode });
    }

    if (!isInternalAlertmanager(uid)) {
      disableGrafanaManagedAlerts(uid);
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
    configuration,
    forwardingDisabled,
    externalAlertmanagerDataSourcesWithStatus: externalAlertmanagersWithStatus,

    enableAlertmanager,
    disableAlertmanager,

    isLoading: isLoadingConfiguration,
    isUpdating: updateConfigurationState.isLoading || enableOrDisableHandlingGrafanaManagedAlertsState.isLoading,

    // CRUD for Alertmanager settings
    updateAlertmanagerSettings,
    resetAlertmanagerSettings,
  };

  return <SettingsContext.Provider value={value}>{props.children}</SettingsContext.Provider>;
};

function determineDeliveryMode(interestedAlertmanagers: string[]): AlertmanagerChoice | null {
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
  appEvents.publish({
    type: AppEvents.alertError.name,
    payload: ['You need to have at least one Alertmanager to receive alerts.'],
  });

  return null;
}

export function useSettings() {
  const context = useContext(SettingsContext);

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

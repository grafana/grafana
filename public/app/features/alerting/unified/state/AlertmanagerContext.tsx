import * as React from 'react';

import { config, locationService } from '@grafana/runtime';
import store from 'app/core/store';
import { AlertManagerDataSourceJsonData, AlertManagerImplementation } from 'app/plugins/datasource/alertmanager/types';
import grafanaIconSvg from 'img/grafana_icon.svg';

import { useAlertManagersByPermission } from '../hooks/useAlertManagerSources';
import { useAlertmanagerConfig } from '../hooks/useAlertmanagerConfig';
import { EXTRA_CONFIG_UID, isExtraConfig } from '../utils/alertmanager/extraConfigs';
import { ALERTMANAGER_NAME_LOCAL_STORAGE_KEY, ALERTMANAGER_NAME_QUERY_KEY } from '../utils/constants';
import {
  AlertManagerDataSource,
  GRAFANA_RULES_SOURCE_NAME,
  getAlertmanagerDataSourceByName,
} from '../utils/datasource';

interface Context {
  selectedAlertmanager: string | undefined;
  hasConfigurationAPI: boolean; // returns true when a configuration API is available
  isGrafanaAlertmanager: boolean; // returns true if we are dealing with the built-in Alertmanager
  selectedAlertmanagerConfig: AlertManagerDataSourceJsonData | undefined;
  availableAlertManagers: AlertManagerDataSource[];
  setSelectedAlertmanager: (name: string) => void;
}

const AlertmanagerContext = React.createContext<Context | undefined>(undefined);

interface Props extends React.PropsWithChildren {
  accessType: 'instance' | 'notification';
  // manually setting the alertmanagersource name will override all of the other sources
  alertmanagerSourceName?: string;
}

const AlertmanagerProvider = ({ children, accessType, alertmanagerSourceName }: Props) => {
  const queryParams = locationService.getSearch();
  const updateQueryParams = locationService.partial;
  const allAvailableAlertManagers = useAlertManagersByPermission(accessType);
  const isExtraConfigEnabled = config.featureToggles.alertingImportAlertmanagerUI ?? false;

  const { data: grafanaConfig } = useAlertmanagerConfig(isExtraConfigEnabled ? GRAFANA_RULES_SOURCE_NAME : undefined, {
    refetchOnFocus: false,
    refetchOnReconnect: false,
  });
  const hasExtraConfigs = Boolean(grafanaConfig?.extra_config && grafanaConfig.extra_config.length > 0);

  const availableAlertManagers = React.useMemo(() => {
    const regularAlertManagers = allAvailableAlertManagers.availableInternalDataSources.concat(
      allAvailableAlertManagers.availableExternalDataSources
    );

    const extraConfigDataSource: AlertManagerDataSource[] =
      isExtraConfigEnabled && hasExtraConfigs
        ? [
            {
              name: EXTRA_CONFIG_UID,
              displayName: 'Grafana (imported)',
              imgUrl: grafanaIconSvg,
              hasConfigurationAPI: false,
              handleGrafanaManagedAlerts: true,
            },
          ]
        : [];

    // list in order: Grafana -> Extra Config -> Extra Alertmanagers
    const grafanaAlertmanager = regularAlertManagers.find((am) => am.name === GRAFANA_RULES_SOURCE_NAME);
    const datasourceAlertmanagers = regularAlertManagers.filter((am) => am.name !== GRAFANA_RULES_SOURCE_NAME);
    const orderedAlertManagers: AlertManagerDataSource[] = [];

    if (grafanaAlertmanager) {
      orderedAlertManagers.push(grafanaAlertmanager);
    }

    orderedAlertManagers.push(...extraConfigDataSource);
    orderedAlertManagers.push(...datasourceAlertmanagers);

    return orderedAlertManagers;
  }, [allAvailableAlertManagers, isExtraConfigEnabled, hasExtraConfigs]);

  const updateSelectedAlertmanager = React.useCallback(
    (selectedAlertManager: string) => {
      if (!isAlertManagerAvailable(availableAlertManagers, selectedAlertManager)) {
        return;
      }

      if (selectedAlertManager === GRAFANA_RULES_SOURCE_NAME) {
        store.delete(ALERTMANAGER_NAME_LOCAL_STORAGE_KEY);
        updateQueryParams({ [ALERTMANAGER_NAME_QUERY_KEY]: undefined });
      } else {
        store.set(ALERTMANAGER_NAME_LOCAL_STORAGE_KEY, selectedAlertManager);
        updateQueryParams({ [ALERTMANAGER_NAME_QUERY_KEY]: selectedAlertManager });
      }
    },
    [availableAlertManagers, updateQueryParams]
  );

  const sourceFromQuery = queryParams.get(ALERTMANAGER_NAME_QUERY_KEY);
  const sourceFromStore = store.get(ALERTMANAGER_NAME_LOCAL_STORAGE_KEY);
  const defaultSource = GRAFANA_RULES_SOURCE_NAME;

  // This overrides AM in the store to be in sync with the one in the URL
  // When the user uses multiple tabs with different AMs, the store will be changing all the time
  // It's safest to always use URLs with alertmanager query param
  React.useEffect(() => {
    if (sourceFromQuery && sourceFromQuery !== sourceFromStore) {
      store.set(ALERTMANAGER_NAME_LOCAL_STORAGE_KEY, sourceFromQuery);
    }
  }, [sourceFromQuery, sourceFromStore]);

  // queryParam > localStorage > default
  const desiredAlertmanager = alertmanagerSourceName ?? sourceFromQuery ?? sourceFromStore ?? defaultSource;
  const selectedAlertmanager = isAlertManagerAvailable(availableAlertManagers, desiredAlertmanager)
    ? desiredAlertmanager
    : undefined;

  const selectedAlertmanagerConfig = React.useMemo(() => {
    if (selectedAlertmanager && isExtraConfig(selectedAlertmanager)) {
      const config: AlertManagerDataSourceJsonData = {
        implementation: AlertManagerImplementation.prometheus,
        handleGrafanaManagedAlerts: true,
      };
      return config;
    }
    return getAlertmanagerDataSourceByName(selectedAlertmanager)?.jsonData;
  }, [selectedAlertmanager]);

  // determine if we're dealing with an Alertmanager data source that supports the ruler API
  const isGrafanaAlertmanager = selectedAlertmanager === GRAFANA_RULES_SOURCE_NAME;
  const isAlertmanagerWithConfigAPI = selectedAlertmanagerConfig
    ? isAlertManagerWithConfigAPI(selectedAlertmanagerConfig)
    : false;

  const hasConfigurationAPI = isGrafanaAlertmanager || isAlertmanagerWithConfigAPI;

  const value: Context = {
    selectedAlertmanager,
    hasConfigurationAPI,
    isGrafanaAlertmanager,
    selectedAlertmanagerConfig,
    availableAlertManagers,
    setSelectedAlertmanager: updateSelectedAlertmanager,
  };

  return <AlertmanagerContext.Provider value={value}>{children}</AlertmanagerContext.Provider>;
};

function useAlertmanager() {
  const context = React.useContext(AlertmanagerContext);

  if (context === undefined) {
    throw new Error('useAlertmanager must be used within a AlertmanagerContext');
  }

  return context;
}

export { AlertmanagerProvider, useAlertmanager };

function isAlertManagerAvailable(availableAlertManagers: AlertManagerDataSource[], alertManagerName: string) {
  const availableAlertManagersNames = availableAlertManagers.map((am) => am.name);
  return availableAlertManagersNames.includes(alertManagerName);
}

// when the `implementation` is set to `undefined` we assume we're dealing with an AlertManager with config API. The reason for this is because
// our Hosted Grafana stacks provision Alertmanager data sources without `jsonData: { implementation: "mimir" }`.
const CONFIG_API_ENABLED_ALERTMANAGER_FLAVORS = [
  AlertManagerImplementation.mimir,
  AlertManagerImplementation.cortex,
  undefined,
];

export function isAlertManagerWithConfigAPI(dataSourceConfig: AlertManagerDataSourceJsonData): boolean {
  return CONFIG_API_ENABLED_ALERTMANAGER_FLAVORS.includes(dataSourceConfig.implementation);
}

import * as React from 'react';

import { useQueryParams } from 'app/core/hooks/useQueryParams';
import store from 'app/core/store';
import { AlertManagerDataSourceJsonData, AlertManagerImplementation } from 'app/plugins/datasource/alertmanager/types';

import { useAlertManagersByPermission } from '../hooks/useAlertManagerSources';
import { ALERTMANAGER_NAME_LOCAL_STORAGE_KEY, ALERTMANAGER_NAME_QUERY_KEY } from '../utils/constants';
import {
  AlertManagerDataSource,
  getAlertmanagerDataSourceByName,
  GRAFANA_RULES_SOURCE_NAME,
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
  const [queryParams, updateQueryParams] = useQueryParams();
  const availableAlertManagers = useAlertManagersByPermission(accessType);

  const updateSelectedAlertmanager = React.useCallback(
    (selectedAlertManager: string) => {
      if (!isAlertManagerAvailable(availableAlertManagers, selectedAlertManager)) {
        return;
      }

      if (selectedAlertManager === GRAFANA_RULES_SOURCE_NAME) {
        store.delete(ALERTMANAGER_NAME_LOCAL_STORAGE_KEY);
        updateQueryParams({ [ALERTMANAGER_NAME_QUERY_KEY]: null });
      } else {
        store.set(ALERTMANAGER_NAME_LOCAL_STORAGE_KEY, selectedAlertManager);
        updateQueryParams({ [ALERTMANAGER_NAME_QUERY_KEY]: selectedAlertManager });
      }
    },
    [availableAlertManagers, updateQueryParams]
  );

  const sourceFromQuery = queryParams[ALERTMANAGER_NAME_QUERY_KEY];
  const sourceFromStore = store.get(ALERTMANAGER_NAME_LOCAL_STORAGE_KEY);
  const defaultSource = GRAFANA_RULES_SOURCE_NAME;

  // queryParam > localStorage > default
  const desiredAlertmanager = alertmanagerSourceName ?? sourceFromQuery ?? sourceFromStore ?? defaultSource;
  const selectedAlertmanager = isAlertManagerAvailable(availableAlertManagers, desiredAlertmanager)
    ? desiredAlertmanager
    : undefined;

  const selectedAlertmanagerConfig = getAlertmanagerDataSourceByName(selectedAlertmanager)?.jsonData;

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

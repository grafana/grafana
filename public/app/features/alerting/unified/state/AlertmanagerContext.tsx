import * as React from 'react';

import { store } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import {
  type AlertManagerDataSourceJsonData,
  AlertManagerImplementation,
} from 'app/plugins/datasource/alertmanager/types';

import { useAlertManagersByPermission } from '../hooks/useAlertManagerSources';
import { ALERTMANAGER_NAME_LOCAL_STORAGE_KEY, ALERTMANAGER_NAME_QUERY_KEY } from '../utils/constants';
import {
  type AlertManagerDataSource,
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

export function getOrgAlertmanagerLocalStorageKey(orgId: number): string {
  return `${ALERTMANAGER_NAME_LOCAL_STORAGE_KEY}-org-${orgId}`;
}

interface Props extends React.PropsWithChildren {
  accessType: 'instance' | 'notification';
  // manually setting the alertmanagersource name will override all of the other sources
  alertmanagerSourceName?: string;
}

const AlertmanagerProvider = ({ children, accessType, alertmanagerSourceName }: Props) => {
  const queryParams = locationService.getSearch();
  const updateQueryParams = locationService.partial;
  const allAvailableAlertManagers = useAlertManagersByPermission(accessType);
  const localStorageKey = getOrgAlertmanagerLocalStorageKey(config.bootData.user.orgId);

  const availableAlertManagers = React.useMemo(() => {
    const regularAlertManagers = allAvailableAlertManagers.availableInternalDataSources.concat(
      allAvailableAlertManagers.availableExternalDataSources
    );

    const grafanaAlertmanager = regularAlertManagers.find((am) => am.name === GRAFANA_RULES_SOURCE_NAME);
    const datasourceAlertmanagers = regularAlertManagers.filter((am) => am.name !== GRAFANA_RULES_SOURCE_NAME);
    const orderedAlertManagers: AlertManagerDataSource[] = [];

    if (grafanaAlertmanager) {
      orderedAlertManagers.push(grafanaAlertmanager);
    }

    orderedAlertManagers.push(...datasourceAlertmanagers);

    return orderedAlertManagers;
  }, [allAvailableAlertManagers]);

  const updateSelectedAlertmanager = React.useCallback(
    (selectedAlertManager: string) => {
      if (!isAlertManagerAvailable(availableAlertManagers, selectedAlertManager)) {
        return;
      }

      if (selectedAlertManager === GRAFANA_RULES_SOURCE_NAME) {
        store.delete(localStorageKey);
        updateQueryParams({ [ALERTMANAGER_NAME_QUERY_KEY]: undefined });
      } else {
        store.set(localStorageKey, selectedAlertManager);
        updateQueryParams({ [ALERTMANAGER_NAME_QUERY_KEY]: selectedAlertManager });
      }
    },
    [availableAlertManagers, localStorageKey, updateQueryParams]
  );

  const sourceFromQuery = queryParams.get(ALERTMANAGER_NAME_QUERY_KEY);
  const sourceFromStore = store.get(localStorageKey);
  const defaultSource = GRAFANA_RULES_SOURCE_NAME;

  // This overrides AM in the store to be in sync with the one in the URL
  // When the user uses multiple tabs with different AMs, the store will be changing all the time
  // It's safest to always use URLs with alertmanager query param
  React.useEffect(() => {
    if (sourceFromQuery && sourceFromQuery !== sourceFromStore) {
      store.set(localStorageKey, sourceFromQuery);
    }
  }, [localStorageKey, sourceFromQuery, sourceFromStore]);

  // queryParam > localStorage > default
  const desiredAlertmanager = alertmanagerSourceName ?? sourceFromQuery ?? sourceFromStore ?? defaultSource;
  const isDesiredAvailable = isAlertManagerAvailable(availableAlertManagers, desiredAlertmanager);

  let selectedAlertmanager: string | undefined;
  if (isDesiredAvailable) {
    selectedAlertmanager = desiredAlertmanager;
  } else if (isAlertManagerAvailable(availableAlertManagers, defaultSource)) {
    selectedAlertmanager = defaultSource;
  }

  // Clean up stale org-scoped key if the stored value no longer resolves to an available AM
  React.useEffect(() => {
    if (sourceFromStore && !isAlertManagerAvailable(availableAlertManagers, sourceFromStore)) {
      store.delete(localStorageKey);
    }
  }, [availableAlertManagers, localStorageKey, sourceFromStore]);

  const selectedAlertmanagerConfig = React.useMemo(() => {
    return selectedAlertmanager ? getAlertmanagerDataSourceByName(selectedAlertmanager)?.jsonData : undefined;
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

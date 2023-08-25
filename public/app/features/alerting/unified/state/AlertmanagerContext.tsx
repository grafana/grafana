import * as React from 'react';

import { useQueryParams } from 'app/core/hooks/useQueryParams';
import store from 'app/core/store';

import { useAlertManagersByPermission } from '../hooks/useAlertManagerSources';
import { ALERTMANAGER_NAME_LOCAL_STORAGE_KEY, ALERTMANAGER_NAME_QUERY_KEY } from '../utils/constants';
import { AlertManagerDataSource, GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

interface Context {
  selectedAlertmanager: string | undefined;
  availableAlertManagers: AlertManagerDataSource[];
  setSelectedAlertmanager: (name: string) => void;
}

const AlertmanagerContext = React.createContext<Context | undefined>(undefined);

interface Props extends React.PropsWithChildren {
  accessType: 'instance' | 'notification';
}

const AlertmanagerProvider = ({ children, accessType }: Props) => {
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
  const desiredAlertmanager = sourceFromQuery ?? sourceFromStore ?? defaultSource;
  const selectedAlertmanager = isAlertManagerAvailable(availableAlertManagers, desiredAlertmanager)
    ? desiredAlertmanager
    : undefined;

  const value: Context = {
    selectedAlertmanager,
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

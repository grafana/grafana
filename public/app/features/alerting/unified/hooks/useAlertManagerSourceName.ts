import { useCallback } from 'react';

import { useQueryParams } from 'app/core/hooks/useQueryParams';
import store from 'app/core/store';

import { ALERTMANAGER_NAME_LOCAL_STORAGE_KEY, ALERTMANAGER_NAME_QUERY_KEY } from '../utils/constants';
import { AlertManagerDataSource, GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

function useIsAlertManagerAvailable(availableAlertManagers: AlertManagerDataSource[]) {
  return useCallback(
    (alertManagerName: string) => {
      const availableAlertManagersNames = availableAlertManagers.map((am) => am.name);
      return availableAlertManagersNames.includes(alertManagerName);
    },
    [availableAlertManagers]
  );
}

/* This will return am name either from query params or from local storage or a default (grafana).
 * Due to RBAC permissions Grafana Managed Alert manager or external alert managers may not be available
 * In the worst case neither GMA nor external alert manager is available
 */
export function useAlertManagerSourceName(
  availableAlertManagers: AlertManagerDataSource[]
): [string | undefined, (alertManagerSourceName: string) => void] {
  const [queryParams, updateQueryParams] = useQueryParams();
  const isAlertManagerAvailable = useIsAlertManagerAvailable(availableAlertManagers);

  const update = useCallback(
    (alertManagerSourceName: string) => {
      if (!isAlertManagerAvailable(alertManagerSourceName)) {
        return;
      }
      if (alertManagerSourceName === GRAFANA_RULES_SOURCE_NAME) {
        store.delete(ALERTMANAGER_NAME_LOCAL_STORAGE_KEY);
        updateQueryParams({ [ALERTMANAGER_NAME_QUERY_KEY]: null });
      } else {
        store.set(ALERTMANAGER_NAME_LOCAL_STORAGE_KEY, alertManagerSourceName);
        updateQueryParams({ [ALERTMANAGER_NAME_QUERY_KEY]: alertManagerSourceName });
      }
    },
    [updateQueryParams, isAlertManagerAvailable]
  );

  const querySource = queryParams[ALERTMANAGER_NAME_QUERY_KEY];

  if (querySource && typeof querySource === 'string') {
    if (isAlertManagerAvailable(querySource)) {
      return [querySource, update];
    } else {
      // non existing alertmanager
      return [undefined, update];
    }
  }

  const storeSource = store.get(ALERTMANAGER_NAME_LOCAL_STORAGE_KEY);
  if (storeSource && typeof storeSource === 'string' && isAlertManagerAvailable(storeSource)) {
    update(storeSource);
    return [storeSource, update];
  }

  if (isAlertManagerAvailable(GRAFANA_RULES_SOURCE_NAME)) {
    return [GRAFANA_RULES_SOURCE_NAME, update];
  }

  return [undefined, update];
}

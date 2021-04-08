import { useQueryParams } from 'app/core/hooks/useQueryParams';
import store from 'app/core/store';
import { useCallback } from 'react';
import { getAlertManagerDataSources, GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

const alertmanagerQueryKey = 'alertmanager';
const alertmanagerLocalStorageKey = 'alerting-alertmanager';

function isAlertManagerSource(alertManagerSourceName: string): boolean {
  return (
    alertManagerSourceName === GRAFANA_RULES_SOURCE_NAME ||
    !!getAlertManagerDataSources().find((ds) => ds.name === alertManagerSourceName)
  );
}

/* this will return am name either from query params or from local storage or a default (grafana).
 * it might makes sense to abstract to more generic impl..
 */
export function useAlertManagerSourceName(): [string, (alertManagerSourceName: string) => void] {
  const [queryParams, updateQueryParams] = useQueryParams();

  const update = useCallback(
    (alertManagerSourceName: string) => {
      if (isAlertManagerSource(alertManagerSourceName)) {
        store.set(alertmanagerLocalStorageKey, alertManagerSourceName);
        updateQueryParams({ [alertmanagerQueryKey]: alertManagerSourceName });
      }
    },
    [updateQueryParams]
  );

  const querySource = queryParams[alertmanagerQueryKey];

  if (querySource && typeof querySource === 'string' && isAlertManagerSource(querySource)) {
    return [querySource, update];
  }
  const storeSource = store.get(alertmanagerLocalStorageKey);
  if (storeSource && typeof storeSource === 'string' && isAlertManagerSource(storeSource)) {
    update(storeSource);
    return [storeSource, update];
  }

  return [GRAFANA_RULES_SOURCE_NAME, update];
}

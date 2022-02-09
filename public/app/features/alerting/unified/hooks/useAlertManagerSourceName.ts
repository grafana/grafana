import { useQueryParams } from 'app/core/hooks/useQueryParams';
import store from 'app/core/store';
import { useCallback } from 'react';
import { ALERTMANAGER_NAME_LOCAL_STORAGE_KEY, ALERTMANAGER_NAME_QUERY_KEY } from '../utils/constants';
import { getAlertManagerDataSources, GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

function isAlertManagerSource(alertManagerSourceName: string): boolean {
  return (
    alertManagerSourceName === GRAFANA_RULES_SOURCE_NAME ||
    !!getAlertManagerDataSources().find((ds) => ds.name === alertManagerSourceName)
  );
}

/* this will return am name either from query params or from local storage or a default (grafana).
 *
 * fallbackUrl - if provided, will redirect to this url if alertmanager provided in query no longer
 */
export function useAlertManagerSourceName(): [string | undefined, (alertManagerSourceName: string) => void] {
  const [queryParams, updateQueryParams] = useQueryParams();

  const update = useCallback(
    (alertManagerSourceName: string) => {
      if (!isAlertManagerSource(alertManagerSourceName)) {
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
    [updateQueryParams]
  );

  const querySource = queryParams[ALERTMANAGER_NAME_QUERY_KEY];

  if (querySource && typeof querySource === 'string') {
    if (isAlertManagerSource(querySource)) {
      return [querySource, update];
    } else {
      // non existing alertmanager
      return [undefined, update];
    }
  }
  const storeSource = store.get(ALERTMANAGER_NAME_LOCAL_STORAGE_KEY);
  if (storeSource && typeof storeSource === 'string' && isAlertManagerSource(storeSource)) {
    update(storeSource);
    return [storeSource, update];
  }

  return [GRAFANA_RULES_SOURCE_NAME, update];
}

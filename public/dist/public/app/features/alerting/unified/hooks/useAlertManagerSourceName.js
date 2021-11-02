import { __read } from "tslib";
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import store from 'app/core/store';
import { useCallback } from 'react';
import { ALERTMANAGER_NAME_LOCAL_STORAGE_KEY, ALERTMANAGER_NAME_QUERY_KEY } from '../utils/constants';
import { getAlertManagerDataSources, GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';
function isAlertManagerSource(alertManagerSourceName) {
    return (alertManagerSourceName === GRAFANA_RULES_SOURCE_NAME ||
        !!getAlertManagerDataSources().find(function (ds) { return ds.name === alertManagerSourceName; }));
}
/* this will return am name either from query params or from local storage or a default (grafana).
 *
 * fallbackUrl - if provided, will redirect to this url if alertmanager provided in query no longer
 */
export function useAlertManagerSourceName() {
    var _a = __read(useQueryParams(), 2), queryParams = _a[0], updateQueryParams = _a[1];
    var update = useCallback(function (alertManagerSourceName) {
        var _a, _b;
        if (!isAlertManagerSource(alertManagerSourceName)) {
            return;
        }
        if (alertManagerSourceName === GRAFANA_RULES_SOURCE_NAME) {
            store.delete(ALERTMANAGER_NAME_LOCAL_STORAGE_KEY);
            updateQueryParams((_a = {}, _a[ALERTMANAGER_NAME_QUERY_KEY] = null, _a));
        }
        else {
            store.set(ALERTMANAGER_NAME_LOCAL_STORAGE_KEY, alertManagerSourceName);
            updateQueryParams((_b = {}, _b[ALERTMANAGER_NAME_QUERY_KEY] = alertManagerSourceName, _b));
        }
    }, [updateQueryParams]);
    var querySource = queryParams[ALERTMANAGER_NAME_QUERY_KEY];
    if (querySource && typeof querySource === 'string') {
        if (isAlertManagerSource(querySource)) {
            return [querySource, update];
        }
        else {
            // non existing alertmanager
            return [undefined, update];
        }
    }
    var storeSource = store.get(ALERTMANAGER_NAME_LOCAL_STORAGE_KEY);
    if (storeSource && typeof storeSource === 'string' && isAlertManagerSource(storeSource)) {
        update(storeSource);
        return [storeSource, update];
    }
    return [GRAFANA_RULES_SOURCE_NAME, update];
}
//# sourceMappingURL=useAlertManagerSourceName.js.map
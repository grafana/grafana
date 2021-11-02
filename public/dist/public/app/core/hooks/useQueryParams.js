import { locationSearchToObject, locationService } from '@grafana/runtime';
import { useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
export function useQueryParams() {
    var search = useLocation().search;
    var queryParams = useMemo(function () { return locationSearchToObject(search || ''); }, [search]);
    var update = useCallback(function (values, replace) { return setImmediate(function () { return locationService.partial(values, replace); }); }, []);
    return [queryParams, update];
}
//# sourceMappingURL=useQueryParams.js.map
import { useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { locationSearchToObject, locationService } from '@grafana/runtime';
export function useQueryParams() {
    const { search } = useLocation();
    const queryParams = useMemo(() => locationSearchToObject(search || ''), [search]);
    const update = useCallback((values, replace) => locationService.partial(values, replace), []);
    return [queryParams, update];
}
//# sourceMappingURL=useQueryParams.js.map
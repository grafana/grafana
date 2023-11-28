import { useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { locationService } from '@grafana/runtime';
export function useURLSearchParams() {
    const { search } = useLocation();
    const queryParams = useMemo(() => new URLSearchParams(search), [search]);
    const update = useCallback((searchValues, replace) => {
        locationService.partial(searchValues, replace);
    }, []);
    return [queryParams, update];
}
//# sourceMappingURL=useURLSearchParams.js.map
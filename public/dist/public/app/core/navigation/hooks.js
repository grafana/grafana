import { useLocation } from 'react-router-dom';
import { locationService } from '@grafana/runtime';
/** @internal experimental */
export function useUrlParams() {
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    const updateUrlParams = (params, replace) => {
        // Should find a way to use history directly here
        locationService.partial(params, replace);
    };
    return [params, updateUrlParams];
}
//# sourceMappingURL=hooks.js.map
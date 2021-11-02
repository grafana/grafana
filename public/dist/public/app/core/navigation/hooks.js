import { locationService } from '@grafana/runtime';
import { useLocation } from 'react-router-dom';
/** @internal experimental */
export function useUrlParams() {
    var location = useLocation();
    var params = new URLSearchParams(location.search);
    var updateUrlParams = function (params, replace) {
        // Should find a way to use history directly here
        locationService.partial(params, replace);
    };
    return [params, updateUrlParams];
}
//# sourceMappingURL=hooks.js.map
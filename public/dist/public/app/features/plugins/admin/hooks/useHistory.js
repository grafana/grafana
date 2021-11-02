import { getLocationSrv } from '@grafana/runtime';
export var useHistory = function () {
    return {
        push: function (_a) {
            var query = _a.query;
            getLocationSrv().update({
                partial: true,
                replace: false,
                query: query,
            });
        },
    };
};
//# sourceMappingURL=useHistory.js.map
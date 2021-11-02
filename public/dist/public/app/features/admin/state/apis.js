import { __awaiter, __generator } from "tslib";
import { getBackendSrv } from '@grafana/runtime';
export var getServerStats = function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, getBackendSrv()
                .get('api/admin/stats')
                .catch(function (err) {
                console.error(err);
                return null;
            })];
    });
}); };
//# sourceMappingURL=apis.js.map
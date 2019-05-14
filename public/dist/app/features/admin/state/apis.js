var _this = this;
import * as tslib_1 from "tslib";
import { getBackendSrv } from 'app/core/services/backend_srv';
export var getServerStats = function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
    var res, error_1;
    return tslib_1.__generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, getBackendSrv().get('api/admin/stats')];
            case 1:
                res = _a.sent();
                return [2 /*return*/, [
                        { name: 'Total users', value: res.users },
                        { name: 'Total dashboards', value: res.dashboards },
                        { name: 'Active users (seen last 30 days)', value: res.activeUsers },
                        { name: 'Total orgs', value: res.orgs },
                        { name: 'Total playlists', value: res.playlists },
                        { name: 'Total snapshots', value: res.snapshots },
                        { name: 'Total dashboard tags', value: res.tags },
                        { name: 'Total starred dashboards', value: res.stars },
                        { name: 'Total alerts', value: res.alerts },
                    ]];
            case 2:
                error_1 = _a.sent();
                console.error(error_1);
                throw error_1;
            case 3: return [2 /*return*/];
        }
    });
}); };
//# sourceMappingURL=apis.js.map
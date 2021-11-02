import { __awaiter, __generator } from "tslib";
import { getBackendSrv } from '@grafana/runtime';
import { organizationLoaded } from './reducers';
import { updateConfigurationSubtitle } from 'app/core/actions';
export function loadOrganization(dependencies) {
    var _this = this;
    if (dependencies === void 0) { dependencies = { getBackendSrv: getBackendSrv }; }
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        var organizationResponse;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, dependencies.getBackendSrv().get('/api/org')];
                case 1:
                    organizationResponse = _a.sent();
                    dispatch(organizationLoaded(organizationResponse));
                    return [2 /*return*/, organizationResponse];
            }
        });
    }); };
}
export function updateOrganization(dependencies) {
    var _this = this;
    if (dependencies === void 0) { dependencies = { getBackendSrv: getBackendSrv }; }
    return function (dispatch, getStore) { return __awaiter(_this, void 0, void 0, function () {
        var organization;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    organization = getStore().organization.organization;
                    return [4 /*yield*/, dependencies.getBackendSrv().put('/api/org', { name: organization.name })];
                case 1:
                    _a.sent();
                    dispatch(updateConfigurationSubtitle(organization.name));
                    dispatch(loadOrganization(dependencies));
                    return [2 /*return*/];
            }
        });
    }); };
}
//# sourceMappingURL=actions.js.map
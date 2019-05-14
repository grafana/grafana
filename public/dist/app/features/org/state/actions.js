import * as tslib_1 from "tslib";
import { getBackendSrv } from 'app/core/services/backend_srv';
export var ActionTypes;
(function (ActionTypes) {
    ActionTypes["LoadOrganization"] = "LOAD_ORGANIZATION";
    ActionTypes["SetOrganizationName"] = "SET_ORGANIZATION_NAME";
})(ActionTypes || (ActionTypes = {}));
var organizationLoaded = function (organization) { return ({
    type: ActionTypes.LoadOrganization,
    payload: organization,
}); };
export var setOrganizationName = function (orgName) { return ({
    type: ActionTypes.SetOrganizationName,
    payload: orgName,
}); };
export function loadOrganization() {
    var _this = this;
    return function (dispatch) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var organizationResponse;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().get('/api/org')];
                case 1:
                    organizationResponse = _a.sent();
                    dispatch(organizationLoaded(organizationResponse));
                    return [2 /*return*/, organizationResponse];
            }
        });
    }); };
}
export function updateOrganization() {
    var _this = this;
    return function (dispatch, getStore) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var organization;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    organization = getStore().organization.organization;
                    return [4 /*yield*/, getBackendSrv().put('/api/org', { name: organization.name })];
                case 1:
                    _a.sent();
                    dispatch(loadOrganization());
                    return [2 /*return*/];
            }
        });
    }); };
}
//# sourceMappingURL=actions.js.map
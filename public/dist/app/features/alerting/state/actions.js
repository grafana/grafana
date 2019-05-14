import * as tslib_1 from "tslib";
import { getBackendSrv } from 'app/core/services/backend_srv';
export var ActionTypes;
(function (ActionTypes) {
    ActionTypes["LoadAlertRules"] = "LOAD_ALERT_RULES";
    ActionTypes["LoadedAlertRules"] = "LOADED_ALERT_RULES";
    ActionTypes["SetSearchQuery"] = "SET_ALERT_SEARCH_QUERY";
})(ActionTypes || (ActionTypes = {}));
export var loadAlertRules = function () { return ({
    type: ActionTypes.LoadAlertRules,
}); };
export var loadedAlertRules = function (rules) { return ({
    type: ActionTypes.LoadedAlertRules,
    payload: rules,
}); };
export var setSearchQuery = function (query) { return ({
    type: ActionTypes.SetSearchQuery,
    payload: query,
}); };
export function getAlertRulesAsync(options) {
    var _this = this;
    return function (dispatch) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var rules;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    dispatch(loadAlertRules());
                    return [4 /*yield*/, getBackendSrv().get('/api/alerts', options)];
                case 1:
                    rules = _a.sent();
                    dispatch(loadedAlertRules(rules));
                    return [2 /*return*/];
            }
        });
    }); };
}
export function togglePauseAlertRule(id, options) {
    var _this = this;
    return function (dispatch, getState) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var stateFilter;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().post("/api/alerts/" + id + "/pause", options)];
                case 1:
                    _a.sent();
                    stateFilter = getState().location.query.state || 'all';
                    dispatch(getAlertRulesAsync({ state: stateFilter.toString() }));
                    return [2 /*return*/];
            }
        });
    }); };
}
//# sourceMappingURL=actions.js.map
import * as tslib_1 from "tslib";
import { getBackendSrv } from 'app/core/services/backend_srv';
export var ActionTypes;
(function (ActionTypes) {
    ActionTypes["LoadApiKeys"] = "LOAD_API_KEYS";
    ActionTypes["SetApiKeysSearchQuery"] = "SET_API_KEYS_SEARCH_QUERY";
})(ActionTypes || (ActionTypes = {}));
var apiKeysLoaded = function (apiKeys) { return ({
    type: ActionTypes.LoadApiKeys,
    payload: apiKeys,
}); };
export function addApiKey(apiKey, openModal) {
    var _this = this;
    return function (dispatch) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var result;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().post('/api/auth/keys', apiKey)];
                case 1:
                    result = _a.sent();
                    dispatch(setSearchQuery(''));
                    dispatch(loadApiKeys());
                    openModal(result.key);
                    return [2 /*return*/];
            }
        });
    }); };
}
export function loadApiKeys() {
    var _this = this;
    return function (dispatch) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var response;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().get('/api/auth/keys')];
                case 1:
                    response = _a.sent();
                    dispatch(apiKeysLoaded(response));
                    return [2 /*return*/];
            }
        });
    }); };
}
export function deleteApiKey(id) {
    var _this = this;
    return function (dispatch) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        return tslib_1.__generator(this, function (_a) {
            getBackendSrv()
                .delete('/api/auth/keys/' + id)
                .then(dispatch(loadApiKeys()));
            return [2 /*return*/];
        });
    }); };
}
export var setSearchQuery = function (searchQuery) { return ({
    type: ActionTypes.SetApiKeysSearchQuery,
    payload: searchQuery,
}); };
//# sourceMappingURL=actions.js.map
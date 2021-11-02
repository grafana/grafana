import { __awaiter, __generator } from "tslib";
import { getBackendSrv } from 'app/core/services/backend_srv';
import { apiKeysLoaded, setSearchQuery } from './reducers';
export function addApiKey(apiKey, openModal, includeExpired) {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().post('/api/auth/keys', apiKey)];
                case 1:
                    result = _a.sent();
                    dispatch(setSearchQuery(''));
                    dispatch(loadApiKeys(includeExpired));
                    openModal(result.key);
                    return [2 /*return*/];
            }
        });
    }); };
}
export function loadApiKeys(includeExpired) {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().get('/api/auth/keys?includeExpired=' + includeExpired)];
                case 1:
                    response = _a.sent();
                    dispatch(apiKeysLoaded(response));
                    return [2 /*return*/];
            }
        });
    }); };
}
export function deleteApiKey(id, includeExpired) {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            getBackendSrv()
                .delete("/api/auth/keys/" + id)
                .then(function () { return dispatch(loadApiKeys(includeExpired)); });
            return [2 /*return*/];
        });
    }); };
}
//# sourceMappingURL=actions.js.map
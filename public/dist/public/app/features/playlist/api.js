import { __awaiter, __generator } from "tslib";
import { getBackendSrv } from '@grafana/runtime';
import { dispatch } from '../../store/store';
import { notifyApp } from '../../core/actions';
import { createErrorNotification, createSuccessNotification } from '../../core/copy/appNotification';
export function createPlaylist(playlist) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, withErrorHandling(function () { return getBackendSrv().post('/api/playlists', playlist); })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
export function updatePlaylist(id, playlist) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, withErrorHandling(function () { return getBackendSrv().put("/api/playlists/" + id, playlist); })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
export function deletePlaylist(id) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, withErrorHandling(function () { return getBackendSrv().delete("/api/playlists/" + id); }, 'Playlist deleted')];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
export function getPlaylist(id) {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().get("/api/playlists/" + id)];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result];
            }
        });
    });
}
export function getAllPlaylist(query) {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().get('/api/playlists/', { query: query })];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result];
            }
        });
    });
}
function withErrorHandling(apiCall, message) {
    if (message === void 0) { message = 'Playlist saved'; }
    return __awaiter(this, void 0, void 0, function () {
        var e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, apiCall()];
                case 1:
                    _a.sent();
                    dispatch(notifyApp(createSuccessNotification(message)));
                    return [3 /*break*/, 3];
                case 2:
                    e_1 = _a.sent();
                    dispatch(notifyApp(createErrorNotification('Unable to save playlist', e_1)));
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
//# sourceMappingURL=api.js.map
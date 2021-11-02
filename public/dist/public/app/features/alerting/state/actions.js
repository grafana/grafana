import { __assign, __awaiter, __generator } from "tslib";
import { AppEvents } from '@grafana/data';
import { getBackendSrv, locationService } from '@grafana/runtime';
import { appEvents } from 'app/core/core';
import { loadAlertRules, loadedAlertRules, notificationChannelLoaded, setNotificationChannels } from './reducers';
export function getAlertRulesAsync(options) {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        var rules;
        return __generator(this, function (_a) {
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
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        var stateFilter;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().post("/api/alerts/" + id + "/pause", options)];
                case 1:
                    _a.sent();
                    stateFilter = locationService.getSearchObject().state || 'all';
                    dispatch(getAlertRulesAsync({ state: stateFilter.toString() }));
                    return [2 /*return*/];
            }
        });
    }); };
}
export function createNotificationChannel(data) {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, getBackendSrv().post("/api/alert-notifications", data)];
                case 1:
                    _a.sent();
                    appEvents.emit(AppEvents.alertSuccess, ['Notification created']);
                    locationService.push('/alerting/notifications');
                    return [3 /*break*/, 3];
                case 2:
                    error_1 = _a.sent();
                    appEvents.emit(AppEvents.alertError, [error_1.data.error]);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); };
}
export function updateNotificationChannel(data) {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        var error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, getBackendSrv().put("/api/alert-notifications/" + data.id, data)];
                case 1:
                    _a.sent();
                    appEvents.emit(AppEvents.alertSuccess, ['Notification updated']);
                    return [3 /*break*/, 3];
                case 2:
                    error_2 = _a.sent();
                    appEvents.emit(AppEvents.alertError, [error_2.data.error]);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); };
}
export function testNotificationChannel(data) {
    var _this = this;
    return function (dispatch, getState) { return __awaiter(_this, void 0, void 0, function () {
        var channel;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    channel = getState().notificationChannel.notificationChannel;
                    return [4 /*yield*/, getBackendSrv().post('/api/alert-notifications/test', __assign({ id: channel.id }, data))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
}
export function loadNotificationTypes() {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        var alertNotifiers, notificationTypes;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().get("/api/alert-notifiers")];
                case 1:
                    alertNotifiers = _a.sent();
                    notificationTypes = alertNotifiers.sort(function (o1, o2) {
                        if (o1.name > o2.name) {
                            return 1;
                        }
                        return -1;
                    });
                    dispatch(setNotificationChannels(notificationTypes));
                    return [2 /*return*/];
            }
        });
    }); };
}
export function loadNotificationChannel(id) {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        var notificationChannel;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, dispatch(loadNotificationTypes())];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, getBackendSrv().get("/api/alert-notifications/" + id)];
                case 2:
                    notificationChannel = _a.sent();
                    dispatch(notificationChannelLoaded(notificationChannel));
                    return [2 /*return*/];
            }
        });
    }); };
}
//# sourceMappingURL=actions.js.map
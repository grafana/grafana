import { __awaiter, __generator } from "tslib";
import { lastValueFrom } from 'rxjs';
import { urlUtil } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { getDatasourceAPIId, GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';
// "grafana" for grafana-managed, otherwise a datasource name
export function fetchAlertManagerConfig(alertManagerSourceName) {
    var _a, _b, _c, _d;
    return __awaiter(this, void 0, void 0, function () {
        var result, e_1;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _e.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, lastValueFrom(getBackendSrv().fetch({
                            url: "/api/alertmanager/" + getDatasourceAPIId(alertManagerSourceName) + "/config/api/v1/alerts",
                            showErrorAlert: false,
                            showSuccessAlert: false,
                        }))];
                case 1:
                    result = _e.sent();
                    return [2 /*return*/, {
                            template_files: (_a = result.data.template_files) !== null && _a !== void 0 ? _a : {},
                            alertmanager_config: (_b = result.data.alertmanager_config) !== null && _b !== void 0 ? _b : {},
                        }];
                case 2:
                    e_1 = _e.sent();
                    // if no config has been uploaded to grafana, it returns error instead of latest config
                    if (alertManagerSourceName === GRAFANA_RULES_SOURCE_NAME &&
                        ((_d = (_c = e_1.data) === null || _c === void 0 ? void 0 : _c.message) === null || _d === void 0 ? void 0 : _d.includes('could not find an Alertmanager configuration'))) {
                        return [2 /*return*/, {
                                template_files: {},
                                alertmanager_config: {},
                            }];
                    }
                    throw e_1;
                case 3: return [2 /*return*/];
            }
        });
    });
}
export function updateAlertManagerConfig(alertManagerSourceName, config) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, lastValueFrom(getBackendSrv().fetch({
                        method: 'POST',
                        url: "/api/alertmanager/" + getDatasourceAPIId(alertManagerSourceName) + "/config/api/v1/alerts",
                        data: config,
                        showErrorAlert: false,
                        showSuccessAlert: false,
                    }))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
export function deleteAlertManagerConfig(alertManagerSourceName) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, lastValueFrom(getBackendSrv().fetch({
                        method: 'DELETE',
                        url: "/api/alertmanager/" + getDatasourceAPIId(alertManagerSourceName) + "/config/api/v1/alerts",
                        showErrorAlert: false,
                        showSuccessAlert: false,
                    }))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
export function fetchSilences(alertManagerSourceName) {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, lastValueFrom(getBackendSrv().fetch({
                        url: "/api/alertmanager/" + getDatasourceAPIId(alertManagerSourceName) + "/api/v2/silences",
                        showErrorAlert: false,
                        showSuccessAlert: false,
                    }))];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.data];
            }
        });
    });
}
// returns the new silence ID. Even in the case of an update, a new silence is created and the previous one expired.
export function createOrUpdateSilence(alertmanagerSourceName, payload) {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, lastValueFrom(getBackendSrv().fetch({
                        url: "/api/alertmanager/" + getDatasourceAPIId(alertmanagerSourceName) + "/api/v2/silences",
                        data: payload,
                        showErrorAlert: false,
                        showSuccessAlert: false,
                        method: 'POST',
                    }))];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.data];
            }
        });
    });
}
export function expireSilence(alertmanagerSourceName, silenceID) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().delete("/api/alertmanager/" + getDatasourceAPIId(alertmanagerSourceName) + "/api/v2/silence/" + encodeURIComponent(silenceID))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
export function fetchAlerts(alertmanagerSourceName, matchers, silenced, active, inhibited) {
    if (silenced === void 0) { silenced = true; }
    if (active === void 0) { active = true; }
    if (inhibited === void 0) { inhibited = true; }
    return __awaiter(this, void 0, void 0, function () {
        var filters, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    filters = urlUtil.toUrlParams({ silenced: silenced, active: active, inhibited: inhibited }) +
                        (matchers === null || matchers === void 0 ? void 0 : matchers.map(function (matcher) {
                            return "filter=" + encodeURIComponent(escapeQuotes(matcher.name) + "=" + (matcher.isRegex ? '~' : '') + "\"" + escapeQuotes(matcher.value) + "\"");
                        }).join('&')) || '';
                    return [4 /*yield*/, lastValueFrom(getBackendSrv().fetch({
                            url: "/api/alertmanager/" + getDatasourceAPIId(alertmanagerSourceName) + "/api/v2/alerts" +
                                (filters ? '?' + filters : ''),
                            showErrorAlert: false,
                            showSuccessAlert: false,
                        }))];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.data];
            }
        });
    });
}
export function fetchAlertGroups(alertmanagerSourceName) {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, lastValueFrom(getBackendSrv().fetch({
                        url: "/api/alertmanager/" + getDatasourceAPIId(alertmanagerSourceName) + "/api/v2/alerts/groups",
                        showErrorAlert: false,
                        showSuccessAlert: false,
                    }))];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.data];
            }
        });
    });
}
export function fetchStatus(alertManagerSourceName) {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, lastValueFrom(getBackendSrv().fetch({
                        url: "/api/alertmanager/" + getDatasourceAPIId(alertManagerSourceName) + "/api/v2/status",
                        showErrorAlert: false,
                        showSuccessAlert: false,
                    }))];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.data];
            }
        });
    });
}
export function testReceivers(alertManagerSourceName, receivers) {
    return __awaiter(this, void 0, void 0, function () {
        var data, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    data = {
                        receivers: receivers,
                    };
                    return [4 /*yield*/, lastValueFrom(getBackendSrv().fetch({
                            method: 'POST',
                            data: data,
                            url: "/api/alertmanager/" + getDatasourceAPIId(alertManagerSourceName) + "/config/api/v1/receivers/test",
                            showErrorAlert: false,
                            showSuccessAlert: false,
                        }))];
                case 1:
                    result = _a.sent();
                    // api returns 207 if one or more receivers has failed test. Collect errors in this case
                    if (result.status === 207) {
                        throw new Error(result.data.receivers
                            .flatMap(function (receiver) {
                            return receiver.grafana_managed_receiver_configs
                                .filter(function (receiver) { return receiver.status === 'failed'; })
                                .map(function (receiver) { var _a; return (_a = receiver.error) !== null && _a !== void 0 ? _a : 'Unknown error.'; });
                        })
                            .join('; '));
                    }
                    return [2 /*return*/];
            }
        });
    });
}
export function addAlertManagers(alertManagers) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, lastValueFrom(getBackendSrv().fetch({
                        method: 'POST',
                        data: { alertmanagers: alertManagers },
                        url: '/api/v1/ngalert/admin_config',
                        showErrorAlert: false,
                        showSuccessAlert: false,
                    })).then(function () {
                        fetchExternalAlertmanagerConfig();
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
export function fetchExternalAlertmanagers() {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, lastValueFrom(getBackendSrv().fetch({
                        method: 'GET',
                        url: '/api/v1/ngalert/alertmanagers',
                    }))];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.data];
            }
        });
    });
}
export function fetchExternalAlertmanagerConfig() {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, lastValueFrom(getBackendSrv().fetch({
                        method: 'GET',
                        url: '/api/v1/ngalert/admin_config',
                    }))];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.data];
            }
        });
    });
}
function escapeQuotes(value) {
    return value.replace(/"/g, '\\"');
}
//# sourceMappingURL=alertmanager.js.map
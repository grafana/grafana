import { __assign, __awaiter, __generator } from "tslib";
import { lastValueFrom } from 'rxjs';
import { getBackendSrv } from '@grafana/runtime';
import { getDatasourceAPIId, GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';
import { RULER_NOT_SUPPORTED_MSG } from '../utils/constants';
// upsert a rule group. use this to update rules
export function setRulerRuleGroup(dataSourceName, namespace, group) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, lastValueFrom(getBackendSrv().fetch({
                        method: 'POST',
                        url: "/api/ruler/" + getDatasourceAPIId(dataSourceName) + "/api/v1/rules/" + encodeURIComponent(namespace),
                        data: group,
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
// fetch all ruler rule namespaces and included groups
export function fetchRulerRules(dataSourceName, filter) {
    return __awaiter(this, void 0, void 0, function () {
        var params;
        return __generator(this, function (_a) {
            if ((filter === null || filter === void 0 ? void 0 : filter.dashboardUID) && dataSourceName !== GRAFANA_RULES_SOURCE_NAME) {
                throw new Error('Filtering by dashboard UID is not supported for cloud rules sources.');
            }
            params = {};
            if (filter === null || filter === void 0 ? void 0 : filter.dashboardUID) {
                params['dashboard_uid'] = filter.dashboardUID;
                if (filter.panelId) {
                    params['panel_id'] = String(filter.panelId);
                }
            }
            return [2 /*return*/, rulerGetRequest("/api/ruler/" + getDatasourceAPIId(dataSourceName) + "/api/v1/rules", {}, params)];
        });
    });
}
// fetch rule groups for a particular namespace
// will throw with { status: 404 } if namespace does not exist
export function fetchRulerRulesNamespace(dataSourceName, namespace) {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, rulerGetRequest("/api/ruler/" + getDatasourceAPIId(dataSourceName) + "/api/v1/rules/" + encodeURIComponent(namespace), {})];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result[namespace] || []];
            }
        });
    });
}
// fetch a particular rule group
// will throw with { status: 404 } if rule group does not exist
export function fetchRulerRulesGroup(dataSourceName, namespace, group) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, rulerGetRequest("/api/ruler/" + getDatasourceAPIId(dataSourceName) + "/api/v1/rules/" + encodeURIComponent(namespace) + "/" + encodeURIComponent(group), null)];
        });
    });
}
export function deleteRulerRulesGroup(dataSourceName, namespace, groupName) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, lastValueFrom(getBackendSrv().fetch({
                        url: "/api/ruler/" + getDatasourceAPIId(dataSourceName) + "/api/v1/rules/" + encodeURIComponent(namespace) + "/" + encodeURIComponent(groupName),
                        method: 'DELETE',
                        showSuccessAlert: false,
                        showErrorAlert: false,
                    }))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// false in case ruler is not supported. this is weird, but we'll work on it
function rulerGetRequest(url, empty, params) {
    var _a, _b, _c, _d, _e, _f;
    return __awaiter(this, void 0, void 0, function () {
        var response, e_1;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    _g.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, lastValueFrom(getBackendSrv().fetch({
                            url: url,
                            showErrorAlert: false,
                            showSuccessAlert: false,
                            params: params,
                        }))];
                case 1:
                    response = _g.sent();
                    return [2 /*return*/, response.data];
                case 2:
                    e_1 = _g.sent();
                    if ((e_1 === null || e_1 === void 0 ? void 0 : e_1.status) === 404) {
                        if (((_b = (_a = e_1 === null || e_1 === void 0 ? void 0 : e_1.data) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.includes('group does not exist')) || ((_d = (_c = e_1 === null || e_1 === void 0 ? void 0 : e_1.data) === null || _c === void 0 ? void 0 : _c.message) === null || _d === void 0 ? void 0 : _d.includes('no rule groups found'))) {
                            return [2 /*return*/, empty];
                        }
                        throw new Error('404 from rules config endpoint. Perhaps ruler API is not enabled?');
                    }
                    else if ((e_1 === null || e_1 === void 0 ? void 0 : e_1.status) === 500 &&
                        ((_f = (_e = e_1 === null || e_1 === void 0 ? void 0 : e_1.data) === null || _e === void 0 ? void 0 : _e.message) === null || _f === void 0 ? void 0 : _f.includes('unexpected content type from upstream. expected YAML, got text/html'))) {
                        throw __assign(__assign({}, e_1), { data: __assign(__assign({}, e_1 === null || e_1 === void 0 ? void 0 : e_1.data), { message: RULER_NOT_SUPPORTED_MSG }) });
                    }
                    throw e_1;
                case 3: return [2 /*return*/];
            }
        });
    });
}
export function deleteNamespace(dataSourceName, namespace) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, lastValueFrom(getBackendSrv().fetch({
                        method: 'DELETE',
                        url: "/api/ruler/" + getDatasourceAPIId(dataSourceName) + "/api/v1/rules/" + encodeURIComponent(namespace),
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
//# sourceMappingURL=ruler.js.map
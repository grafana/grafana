import { __awaiter, __generator } from "tslib";
import { lastValueFrom } from 'rxjs';
import { getBackendSrv } from '@grafana/runtime';
import { getDatasourceAPIId, GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';
export function fetchRules(dataSourceName, filter) {
    return __awaiter(this, void 0, void 0, function () {
        var params, response, nsMap;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
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
                    return [4 /*yield*/, lastValueFrom(getBackendSrv().fetch({
                            url: "/api/prometheus/" + getDatasourceAPIId(dataSourceName) + "/api/v1/rules",
                            showErrorAlert: false,
                            showSuccessAlert: false,
                            params: params,
                        })).catch(function (e) {
                            if ('status' in e && e.status === 404) {
                                throw new Error('404 from rule state endpoint. Perhaps ruler API is not enabled?');
                            }
                            throw e;
                        })];
                case 1:
                    response = _a.sent();
                    nsMap = {};
                    response.data.data.groups.forEach(function (group) {
                        group.rules.forEach(function (rule) {
                            rule.query = rule.query || '';
                        });
                        if (!nsMap[group.file]) {
                            nsMap[group.file] = {
                                dataSourceName: dataSourceName,
                                name: group.file,
                                groups: [group],
                            };
                        }
                        else {
                            nsMap[group.file].groups.push(group);
                        }
                    });
                    return [2 /*return*/, Object.values(nsMap)];
            }
        });
    });
}
//# sourceMappingURL=prometheus.js.map
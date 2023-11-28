import { __awaiter } from "tslib";
import { lastValueFrom } from 'rxjs';
import { getBackendSrv } from '@grafana/runtime';
import { getDatasourceAPIUid, GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';
import { isCloudRuleIdentifier, isPrometheusRuleIdentifier } from '../utils/rules';
export function prometheusUrlBuilder(dataSourceConfig) {
    const { dataSourceName, limitAlerts, identifier } = dataSourceConfig;
    return {
        rules: (filter, state, matcher) => {
            const searchParams = new URLSearchParams();
            // if we're fetching for Grafana managed rules, we should add a limit to the number of alert instances
            // we do this because the response is large otherwise and we don't show all of them in the UI anyway.
            if (dataSourceName === GRAFANA_RULES_SOURCE_NAME && limitAlerts) {
                searchParams.set('limit_alerts', String(limitAlerts));
            }
            if (identifier && (isPrometheusRuleIdentifier(identifier) || isCloudRuleIdentifier(identifier))) {
                searchParams.set('file', identifier.namespace);
                searchParams.set('rule_group', identifier.groupName);
            }
            const params = prepareRulesFilterQueryParams(searchParams, filter);
            return {
                url: `/api/prometheus/${getDatasourceAPIUid(dataSourceName)}/api/v1/rules`,
                params: paramsWithMatcherAndState(params, state, matcher),
            };
        },
    };
}
export function prepareRulesFilterQueryParams(params, filter) {
    if (filter === null || filter === void 0 ? void 0 : filter.dashboardUID) {
        params.set('dashboard_uid', filter.dashboardUID);
        if (filter === null || filter === void 0 ? void 0 : filter.panelId) {
            params.set('panel_id', String(filter.panelId));
        }
    }
    return Object.fromEntries(params);
}
export function paramsWithMatcherAndState(params, state, matchers) {
    let paramsResult = Object.assign({}, params);
    if (state === null || state === void 0 ? void 0 : state.length) {
        paramsResult = Object.assign(Object.assign({}, paramsResult), { state });
    }
    if (matchers === null || matchers === void 0 ? void 0 : matchers.length) {
        const matcherToJsonString = matchers.map((m) => JSON.stringify(m));
        paramsResult = Object.assign(Object.assign({}, paramsResult), { matcher: matcherToJsonString });
    }
    return paramsResult;
}
export const groupRulesByFileName = (groups, dataSourceName) => {
    const nsMap = {};
    groups.forEach((group) => {
        group.rules.forEach((rule) => {
            rule.query = rule.query || '';
        });
        if (!nsMap[group.file]) {
            nsMap[group.file] = {
                dataSourceName,
                name: group.file,
                groups: [group],
            };
        }
        else {
            nsMap[group.file].groups.push(group);
        }
    });
    return Object.values(nsMap);
};
export function fetchRules(dataSourceName, filter, limitAlerts, matcher, state, identifier) {
    return __awaiter(this, void 0, void 0, function* () {
        if ((filter === null || filter === void 0 ? void 0 : filter.dashboardUID) && dataSourceName !== GRAFANA_RULES_SOURCE_NAME) {
            throw new Error('Filtering by dashboard UID is only supported for Grafana Managed rules.');
        }
        const { url, params } = prometheusUrlBuilder({ dataSourceName, limitAlerts, identifier }).rules(filter, state, matcher);
        // adding state param here instead of adding it in prometheusUrlBuilder, for being a possible multiple query param
        const response = yield lastValueFrom(getBackendSrv().fetch({
            url,
            params: params,
            showErrorAlert: false,
            showSuccessAlert: false,
        })).catch((e) => {
            if ('status' in e && e.status === 404) {
                throw new Error('404 from rule state endpoint. Perhaps ruler API is not enabled?');
            }
            throw e;
        });
        return groupRulesByFileName(response.data.data.groups, dataSourceName);
    });
}
//# sourceMappingURL=prometheus.js.map
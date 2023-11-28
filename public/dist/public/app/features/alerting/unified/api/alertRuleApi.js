import { getDatasourceAPIUid, GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';
import { arrayKeyValuesToObject } from '../utils/labels';
import { isCloudRuleIdentifier, isPrometheusRuleIdentifier } from '../utils/rules';
import { alertingApi } from './alertingApi';
import { groupRulesByFileName, paramsWithMatcherAndState, prepareRulesFilterQueryParams, } from './prometheus';
import { rulerUrlBuilder } from './ruler';
export const PREVIEW_URL = '/api/v1/rule/test/grafana';
export const PROM_RULES_URL = 'api/prometheus/grafana/api/v1/rules';
export const alertRuleApi = alertingApi.injectEndpoints({
    endpoints: (build) => ({
        preview: build.mutation({
            query: ({ alertQueries, condition, customLabels, folder, alertName, alertUid }) => ({
                url: PREVIEW_URL,
                data: {
                    rule: {
                        grafana_alert: {
                            data: alertQueries,
                            condition: condition,
                            no_data_state: 'Alerting',
                            title: alertName,
                            uid: alertUid !== null && alertUid !== void 0 ? alertUid : 'N/A',
                        },
                        for: '0s',
                        labels: arrayKeyValuesToObject(customLabels),
                        annotations: {},
                    },
                    folderUid: folder.uid,
                    folderTitle: folder.title,
                },
                method: 'POST',
            }),
        }),
        prometheusRulesByNamespace: build.query({
            query: ({ limitAlerts, identifier, filter, state, matcher }) => {
                const searchParams = new URLSearchParams();
                // if we're fetching for Grafana managed rules, we should add a limit to the number of alert instances
                // we do this because the response is large otherwise and we don't show all of them in the UI anyway.
                if (limitAlerts) {
                    searchParams.set('limit_alerts', String(limitAlerts));
                }
                if (identifier && (isPrometheusRuleIdentifier(identifier) || isCloudRuleIdentifier(identifier))) {
                    searchParams.set('file', identifier.namespace);
                    searchParams.set('rule_group', identifier.groupName);
                }
                const params = prepareRulesFilterQueryParams(searchParams, filter);
                return { url: PROM_RULES_URL, params: paramsWithMatcherAndState(params, state, matcher) };
            },
            transformResponse: (response) => {
                return groupRulesByFileName(response.data.groups, GRAFANA_RULES_SOURCE_NAME);
            },
        }),
        prometheusRuleNamespaces: build.query({
            query: ({ ruleSourceName, namespace, groupName, ruleName }) => {
                const queryParams = {};
                // if (isPrometheusRuleIdentifier(ruleIdentifier) || isCloudRuleIdentifier(ruleIdentifier)) {
                queryParams['file'] = namespace;
                queryParams['rule_group'] = groupName;
                queryParams['rule_name'] = ruleName;
                // }
                return {
                    url: `api/prometheus/${getDatasourceAPIUid(ruleSourceName)}/api/v1/rules`,
                    params: queryParams,
                };
            },
            transformResponse: (response, _, args) => {
                return groupRulesByFileName(response.data.groups, args.ruleSourceName);
            },
        }),
        rulerRules: build.query({
            query: ({ rulerConfig, filter }) => {
                const { path, params } = rulerUrlBuilder(rulerConfig).rules(filter);
                return { url: path, params };
            },
        }),
        // TODO This should be probably a separate ruler API file
        rulerRuleGroup: build.query({
            query: ({ rulerConfig, namespace, group }) => {
                const { path, params } = rulerUrlBuilder(rulerConfig).namespaceGroup(namespace, group);
                return { url: path, params };
            },
        }),
        exportRules: build.query({
            query: ({ format, folderUid, group, ruleUid }) => ({
                url: `/api/ruler/grafana/api/v1/export/rules`,
                params: { format: format, folderUid: folderUid, group: group, ruleUid: ruleUid },
                responseType: 'text',
            }),
        }),
        exportReceiver: build.query({
            query: ({ receiverName, decrypt, format }) => ({
                url: `/api/v1/provisioning/contact-points/export/`,
                params: { format: format, decrypt: decrypt, name: receiverName },
                responseType: 'text',
            }),
        }),
        exportReceivers: build.query({
            query: ({ decrypt, format }) => ({
                url: `/api/v1/provisioning/contact-points/export/`,
                params: { format: format, decrypt: decrypt },
                responseType: 'text',
            }),
        }),
        exportPolicies: build.query({
            query: ({ format }) => ({
                url: `/api/v1/provisioning/policies/export/`,
                params: { format: format },
                responseType: 'text',
            }),
        }),
        exportModifiedRuleGroup: build.mutation({
            query: ({ payload, format, nameSpace }) => ({
                url: `/api/ruler/grafana/api/v1/rules/${nameSpace}/export/`,
                params: { format: format },
                responseType: 'text',
                data: payload,
                method: 'POST',
            }),
        }),
    }),
});
//# sourceMappingURL=alertRuleApi.js.map
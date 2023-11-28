import { __awaiter } from "tslib";
import React, { useEffect } from 'react';
import { EditorField, EditorFieldGroup, EditorRow, EditorRows, EditorSwitch } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import { Select } from '@grafana/ui';
import { useAccountOptions, useDimensionKeys, useMetrics, useNamespaces } from '../../../hooks';
import { standardStatistics } from '../../../standardStatistics';
import { appendTemplateVariables, toOption } from '../../../utils/utils';
import { Account } from '../Account';
import { Dimensions } from '../Dimensions/Dimensions';
const percentileSyntaxRE = /^(p|tm|tc|ts|wm)\d{2}(?:\.\d{1,2})?$/;
const boundariesInnerParenthesesSyntax = `\\d*(\\.\\d+)?%?:\\d*(\\.\\d+)?%?`;
const boundariesSyntaxRE = new RegExp(`^(PR|TM|TC|TS|WM)\\((${boundariesInnerParenthesesSyntax})\\)$`);
// used in both Metric Query editor and in Annotations Editor
export const MetricStatEditor = ({ refId, metricStat, datasource, disableExpressions = false, onChange, }) => {
    var _a;
    const namespaces = useNamespaces(datasource);
    const metrics = useMetrics(datasource, metricStat);
    const dimensionKeys = useDimensionKeys(datasource, Object.assign(Object.assign({}, metricStat), { dimensionFilters: metricStat.dimensions }));
    const accountState = useAccountOptions(datasource.resources, metricStat.region);
    useEffect(() => {
        datasource.resources.isMonitoringAccount(metricStat.region).then((isMonitoringAccount) => {
            var _a;
            if (isMonitoringAccount && !accountState.loading && ((_a = accountState.value) === null || _a === void 0 ? void 0 : _a.length) && !metricStat.accountId) {
                onChange(Object.assign(Object.assign({}, metricStat), { accountId: 'all' }));
            }
            if (!accountState.loading && accountState.value && !accountState.value.length && metricStat.accountId) {
                onChange(Object.assign(Object.assign({}, metricStat), { accountId: undefined }));
            }
        });
    }, [accountState, metricStat, onChange, datasource.resources]);
    const onNamespaceChange = (metricStat) => __awaiter(void 0, void 0, void 0, function* () {
        const validatedQuery = yield validateMetricName(metricStat);
        onChange(validatedQuery);
    });
    const validateMetricName = (metricStat) => __awaiter(void 0, void 0, void 0, function* () {
        let { metricName, namespace, region } = metricStat;
        if (!metricName) {
            return metricStat;
        }
        yield datasource.resources.getMetrics({ namespace, region }).then((result) => {
            if (!result.find((metric) => metric.value === metricName)) {
                metricName = '';
            }
        });
        return Object.assign(Object.assign({}, metricStat), { metricName });
    });
    return (React.createElement(EditorRows, null,
        React.createElement(EditorRow, null,
            !disableExpressions && config.featureToggles.cloudWatchCrossAccountQuerying && (React.createElement(Account, { accountId: metricStat.accountId, onChange: (accountId) => {
                    onChange(Object.assign(Object.assign({}, metricStat), { accountId }));
                }, accountOptions: (accountState === null || accountState === void 0 ? void 0 : accountState.value) || [] })),
            React.createElement(EditorFieldGroup, null,
                React.createElement(EditorField, { label: "Namespace", width: 26 },
                    React.createElement(Select, { "aria-label": "Namespace", value: (metricStat === null || metricStat === void 0 ? void 0 : metricStat.namespace) && toOption(metricStat.namespace), allowCustomValue: true, options: namespaces, onChange: ({ value: namespace }) => {
                            if (namespace) {
                                onNamespaceChange(Object.assign(Object.assign({}, metricStat), { namespace }));
                            }
                        } })),
                React.createElement(EditorField, { label: "Metric name", width: 16 },
                    React.createElement(Select, { "aria-label": "Metric name", value: (metricStat === null || metricStat === void 0 ? void 0 : metricStat.metricName) && toOption(metricStat.metricName), allowCustomValue: true, options: metrics, onChange: ({ value: metricName }) => {
                            if (metricName) {
                                onChange(Object.assign(Object.assign({}, metricStat), { metricName }));
                            }
                        } })),
                React.createElement(EditorField, { label: "Statistic", width: 16 },
                    React.createElement(Select, { inputId: `${refId}-metric-stat-editor-select-statistic`, allowCustomValue: true, value: toOption((_a = metricStat.statistic) !== null && _a !== void 0 ? _a : standardStatistics[0]), options: appendTemplateVariables(datasource, standardStatistics.filter((s) => s !== metricStat.statistic).map(toOption)), onChange: ({ value: statistic }) => {
                            if (!statistic ||
                                (!standardStatistics.includes(statistic) &&
                                    !(percentileSyntaxRE.test(statistic) || boundariesSyntaxRE.test(statistic)) &&
                                    !datasource.templateSrv.containsTemplate(statistic))) {
                                return;
                            }
                            onChange(Object.assign(Object.assign({}, metricStat), { statistic }));
                        } })))),
        React.createElement(EditorRow, null,
            React.createElement(EditorField, { label: "Dimensions" },
                React.createElement(Dimensions, { metricStat: metricStat, onChange: (dimensions) => onChange(Object.assign(Object.assign({}, metricStat), { dimensions })), dimensionKeys: dimensionKeys, disableExpressions: disableExpressions, datasource: datasource })),
            !disableExpressions && (React.createElement(EditorField, { label: "Match exact", optional: true, tooltip: "Only show metrics that exactly match all defined dimension names." },
                React.createElement(EditorSwitch, { id: `${refId}-cloudwatch-match-exact`, value: !!metricStat.matchExact, onChange: (e) => {
                        onChange(Object.assign(Object.assign({}, metricStat), { matchExact: e.currentTarget.checked }));
                    } }))))));
};
//# sourceMappingURL=MetricStatEditor.js.map
import { __awaiter } from "tslib";
import React from 'react';
import { CoreApp, LoadingState } from '@grafana/data';
import { EditorHeader, InlineSelect, FlexItem } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import { Badge, Button } from '@grafana/ui';
import { DEFAULT_LOGS_QUERY_STRING } from '../../defaultQueries';
import { isCloudWatchLogsQuery, isCloudWatchMetricsQuery } from '../../guards';
import { useIsMonitoringAccount, useRegions } from '../../hooks';
import { MetricQueryType } from '../../types';
const apiModes = [
    { label: 'CloudWatch Metrics', value: 'Metrics' },
    { label: 'CloudWatch Logs', value: 'Logs' },
];
const QueryHeader = ({ query, onChange, datasource, extraHeaderElementLeft, extraHeaderElementRight, dataIsStale, data, onRunQuery, }) => {
    const { queryMode, region } = query;
    const isMonitoringAccount = useIsMonitoringAccount(datasource.resources, query.region);
    const [regions, regionIsLoading] = useRegions(datasource);
    const emptyLogsExpression = isCloudWatchLogsQuery(query) ? !query.expression : false;
    const onQueryModeChange = ({ value }) => {
        if (value && value !== queryMode) {
            // reset expression to a default string when the query mode changes
            let expression = '';
            if (value === 'Logs') {
                expression = DEFAULT_LOGS_QUERY_STRING;
            }
            onChange(Object.assign(Object.assign(Object.assign({}, datasource.getDefaultQuery(CoreApp.Unknown)), query), { expression, queryMode: value }));
        }
    };
    const onRegionChange = (region) => __awaiter(void 0, void 0, void 0, function* () {
        if (config.featureToggles.cloudWatchCrossAccountQuerying && isCloudWatchMetricsQuery(query)) {
            const isMonitoringAccount = yield datasource.resources.isMonitoringAccount(region);
            onChange(Object.assign(Object.assign({}, query), { region, accountId: isMonitoringAccount ? query.accountId : undefined }));
        }
        else {
            onChange(Object.assign(Object.assign({}, query), { region }));
        }
    });
    const shouldDisplayMonitoringBadge = config.featureToggles.cloudWatchCrossAccountQuerying &&
        isMonitoringAccount &&
        (query.queryMode === 'Logs' ||
            (isCloudWatchMetricsQuery(query) && query.metricQueryType === MetricQueryType.Search));
    return (React.createElement(React.Fragment, null,
        React.createElement(EditorHeader, null,
            React.createElement(InlineSelect, { label: "Region", value: region, placeholder: "Select region", allowCustomValue: true, onChange: ({ value: region }) => region && onRegionChange(region), options: regions, isLoading: regionIsLoading }),
            React.createElement(InlineSelect, { "aria-label": "Query mode", value: queryMode, options: apiModes, onChange: onQueryModeChange, inputId: `cloudwatch-query-mode-${query.refId}`, id: `cloudwatch-query-mode-${query.refId}` }),
            extraHeaderElementLeft,
            React.createElement(FlexItem, { grow: 1 }),
            shouldDisplayMonitoringBadge && (React.createElement(React.Fragment, null,
                React.createElement(Badge, { text: "Monitoring account", color: "blue", tooltip: "AWS monitoring accounts view data from source accounts so you can centralize monitoring and troubleshoot activities" }))),
            React.createElement(Button, { variant: dataIsStale ? 'primary' : 'secondary', size: "sm", onClick: onRunQuery, icon: (data === null || data === void 0 ? void 0 : data.state) === LoadingState.Loading ? 'fa fa-spinner' : undefined, disabled: (data === null || data === void 0 ? void 0 : data.state) === LoadingState.Loading || emptyLogsExpression }, "Run queries"),
            extraHeaderElementRight)));
};
export default QueryHeader;
//# sourceMappingURL=QueryHeader.js.map
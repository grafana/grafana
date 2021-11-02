import { __read } from "tslib";
import { Alert } from '@grafana/ui';
import React, { useCallback, useMemo } from 'react';
import { AzureQueryType, } from '../../types';
import MetricsQueryEditor from '../MetricsQueryEditor';
import QueryTypeField from './QueryTypeField';
import useLastError from '../../utils/useLastError';
import LogsQueryEditor from '../LogsQueryEditor';
import ArgQueryEditor from '../ArgQueryEditor';
import ApplicationInsightsEditor from '../ApplicationInsightsEditor';
import InsightsAnalyticsEditor from '../InsightsAnalyticsEditor';
import { Space } from '../Space';
import { debounce } from 'lodash';
import usePreparedQuery from './usePreparedQuery';
var QueryEditor = function (_a) {
    var baseQuery = _a.query, datasource = _a.datasource, onChange = _a.onChange, baseOnRunQuery = _a.onRunQuery;
    var _b = __read(useLastError(), 2), errorMessage = _b[0], setError = _b[1];
    var onRunQuery = useMemo(function () { return debounce(baseOnRunQuery, 500); }, [baseOnRunQuery]);
    var onQueryChange = useCallback(function (newQuery) {
        onChange(newQuery);
        onRunQuery();
    }, [onChange, onRunQuery]);
    var query = usePreparedQuery(baseQuery, onQueryChange);
    var subscriptionId = query.subscription || datasource.azureMonitorDatasource.defaultSubscriptionId;
    var variableOptionGroup = {
        label: 'Template Variables',
        options: datasource.getVariables().map(function (v) { return ({ label: v, value: v }); }),
    };
    return (React.createElement("div", { "data-testid": "azure-monitor-query-editor" },
        React.createElement(QueryTypeField, { query: query, onQueryChange: onQueryChange }),
        React.createElement(EditorForQueryType, { subscriptionId: subscriptionId, query: query, datasource: datasource, onChange: onQueryChange, variableOptionGroup: variableOptionGroup, setError: setError }),
        errorMessage && (React.createElement(React.Fragment, null,
            React.createElement(Space, { v: 2 }),
            React.createElement(Alert, { severity: "error", title: "An error occurred while requesting metadata from Azure Monitor" }, errorMessage)))));
};
var EditorForQueryType = function (_a) {
    var subscriptionId = _a.subscriptionId, query = _a.query, datasource = _a.datasource, variableOptionGroup = _a.variableOptionGroup, onChange = _a.onChange, setError = _a.setError;
    switch (query.queryType) {
        case AzureQueryType.AzureMonitor:
            return (React.createElement(MetricsQueryEditor, { subscriptionId: subscriptionId, query: query, datasource: datasource, onChange: onChange, variableOptionGroup: variableOptionGroup, setError: setError }));
        case AzureQueryType.LogAnalytics:
            return (React.createElement(LogsQueryEditor, { subscriptionId: subscriptionId, query: query, datasource: datasource, onChange: onChange, variableOptionGroup: variableOptionGroup, setError: setError }));
        case AzureQueryType.ApplicationInsights:
            return React.createElement(ApplicationInsightsEditor, { query: query });
        case AzureQueryType.InsightsAnalytics:
            return React.createElement(InsightsAnalyticsEditor, { query: query });
        case AzureQueryType.AzureResourceGraph:
            return (React.createElement(ArgQueryEditor, { subscriptionId: subscriptionId, query: query, datasource: datasource, onChange: onChange, variableOptionGroup: variableOptionGroup, setError: setError }));
        default:
            return React.createElement(Alert, { title: "Unknown query type" });
    }
    return null;
};
export default QueryEditor;
//# sourceMappingURL=QueryEditor.js.map
import { css } from '@emotion/css';
import { debounce } from 'lodash';
import React, { useCallback, useMemo, useState } from 'react';
import { reportInteraction } from '@grafana/runtime';
import { Alert, Button, CodeEditor } from '@grafana/ui';
import { AzureQueryType, } from '../../types';
import useLastError from '../../utils/useLastError';
import ArgQueryEditor from '../ArgQueryEditor';
import LogsQueryEditor from '../LogsQueryEditor';
import { AzureCheatSheetModal } from '../LogsQueryEditor/AzureCheatSheetModal';
import NewMetricsQueryEditor from '../MetricsQueryEditor/MetricsQueryEditor';
import { QueryHeader } from '../QueryHeader';
import { Space } from '../Space';
import TracesQueryEditor from '../TracesQueryEditor';
import usePreparedQuery from './usePreparedQuery';
const QueryEditor = ({ query: baseQuery, datasource, onChange, onRunQuery: baseOnRunQuery, data, range, }) => {
    const [errorMessage, setError] = useLastError();
    const onRunQuery = useMemo(() => debounce(baseOnRunQuery, 500), [baseOnRunQuery]);
    const [azureLogsCheatSheetModalOpen, setAzureLogsCheatSheetModalOpen] = useState(false);
    const onQueryChange = useCallback((newQuery) => {
        onChange(newQuery);
        onRunQuery();
    }, [onChange, onRunQuery]);
    const query = usePreparedQuery(baseQuery, onQueryChange);
    const subscriptionId = query.subscription || datasource.azureMonitorDatasource.defaultSubscriptionId;
    const variableOptionGroup = {
        label: 'Template Variables',
        options: datasource.getVariables().map((v) => ({ label: v, value: v })),
    };
    return (React.createElement("div", { "data-testid": "azure-monitor-query-editor" },
        React.createElement(AzureCheatSheetModal, { datasource: datasource.azureLogAnalyticsDatasource, isOpen: azureLogsCheatSheetModalOpen, onClose: () => setAzureLogsCheatSheetModalOpen(false), onChange: (a) => onChange(Object.assign(Object.assign({}, a), { queryType: AzureQueryType.LogAnalytics })) }),
        React.createElement("div", { className: css({ display: 'flex', alignItems: 'center' }) },
            React.createElement(QueryHeader, { query: query, onQueryChange: onQueryChange }),
            query.queryType === AzureQueryType.LogAnalytics && (React.createElement(Button, { "aria-label": "Azure logs kick start your query button", variant: "secondary", size: "sm", onClick: () => {
                    setAzureLogsCheatSheetModalOpen((prevValue) => !prevValue);
                    reportInteraction('grafana_azure_logs_query_patterns_opened', {
                        version: 'v2',
                        editorMode: query.azureLogAnalytics,
                    });
                } }, "Kick start your query"))),
        React.createElement(EditorForQueryType, { data: data, subscriptionId: subscriptionId, query: query, datasource: datasource, onChange: onQueryChange, variableOptionGroup: variableOptionGroup, setError: setError, range: range }),
        errorMessage && (React.createElement(React.Fragment, null,
            React.createElement(Space, { v: 2 }),
            React.createElement(Alert, { severity: "error", title: "An error occurred while requesting metadata from Azure Monitor" }, errorMessage instanceof Error ? errorMessage.message : errorMessage)))));
};
const EditorForQueryType = ({ data, subscriptionId, query, datasource, variableOptionGroup, onChange, setError, range, }) => {
    switch (query.queryType) {
        case AzureQueryType.AzureMonitor:
            return (React.createElement(NewMetricsQueryEditor, { data: data, query: query, datasource: datasource, onChange: onChange, variableOptionGroup: variableOptionGroup, setError: setError }));
        case AzureQueryType.LogAnalytics:
            return (React.createElement(LogsQueryEditor, { subscriptionId: subscriptionId, query: query, datasource: datasource, onChange: onChange, variableOptionGroup: variableOptionGroup, setError: setError }));
        case AzureQueryType.AzureResourceGraph:
            return (React.createElement(ArgQueryEditor, { subscriptionId: subscriptionId, query: query, datasource: datasource, onChange: onChange, variableOptionGroup: variableOptionGroup, setError: setError }));
        case AzureQueryType.AzureTraces:
            return (React.createElement(TracesQueryEditor, { subscriptionId: subscriptionId, query: query, datasource: datasource, onChange: onChange, variableOptionGroup: variableOptionGroup, setError: setError, range: range }));
        default:
            const type = query.queryType;
            return (React.createElement(Alert, { title: "Unknown query type" }, (type === 'Application Insights' || type === 'Insights Analytics') && (React.createElement(React.Fragment, null,
                type,
                " was deprecated in Grafana 9. See the",
                ' ',
                React.createElement("a", { href: "https://grafana.com/docs/grafana/latest/datasources/azuremonitor/deprecated-application-insights/", target: "_blank", rel: "noreferrer" }, "deprecation notice"),
                ' ',
                "to get more information about how to migrate your queries. This is the current query definition:",
                React.createElement(CodeEditor, { height: "200px", readOnly: true, language: "json", value: JSON.stringify(query, null, 4) })))));
    }
};
export default QueryEditor;
//# sourceMappingURL=QueryEditor.js.map
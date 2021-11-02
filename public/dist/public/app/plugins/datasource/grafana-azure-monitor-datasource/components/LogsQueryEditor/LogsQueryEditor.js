import React from 'react';
import { Alert, InlineFieldRow } from '@grafana/ui';
import QueryField from './QueryField';
import FormatAsField from './FormatAsField';
import ResourceField from './ResourceField';
import useMigrations from './useMigrations';
var LogsQueryEditor = function (_a) {
    var query = _a.query, datasource = _a.datasource, subscriptionId = _a.subscriptionId, variableOptionGroup = _a.variableOptionGroup, onChange = _a.onChange, setError = _a.setError;
    var migrationError = useMigrations(datasource, query, onChange);
    return (React.createElement("div", { "data-testid": "azure-monitor-logs-query-editor" },
        React.createElement(InlineFieldRow, null,
            React.createElement(ResourceField, { query: query, datasource: datasource, subscriptionId: subscriptionId, variableOptionGroup: variableOptionGroup, onQueryChange: onChange, setError: setError })),
        React.createElement(QueryField, { query: query, datasource: datasource, subscriptionId: subscriptionId, variableOptionGroup: variableOptionGroup, onQueryChange: onChange, setError: setError }),
        React.createElement(FormatAsField, { query: query, datasource: datasource, subscriptionId: subscriptionId, variableOptionGroup: variableOptionGroup, onQueryChange: onChange, setError: setError }),
        migrationError && React.createElement(Alert, { title: migrationError.title }, migrationError.message)));
};
export default LogsQueryEditor;
//# sourceMappingURL=LogsQueryEditor.js.map
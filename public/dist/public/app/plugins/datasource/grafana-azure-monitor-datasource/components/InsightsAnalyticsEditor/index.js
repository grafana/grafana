import { Alert, CodeEditor, Select } from '@grafana/ui';
import React from 'react';
import { Field } from '../Field';
import { Space } from '../Space';
var FORMAT_OPTIONS = [
    { label: 'Time series', value: 'time_series' },
    { label: 'Table', value: 'table' },
];
var InsightsAnalyticsEditor = function (_a) {
    var _b, _c, _d;
    var query = _a.query;
    return (React.createElement("div", { "data-testid": "azure-monitor-insights-analytics-query-editor" },
        React.createElement(CodeEditor, { language: "kusto", value: (_c = (_b = query.insightsAnalytics) === null || _b === void 0 ? void 0 : _b.query) !== null && _c !== void 0 ? _c : '', height: 200, width: "100%", readOnly: true, showMiniMap: false }),
        React.createElement(Field, { label: "Format as" },
            React.createElement(Select, { menuShouldPortal: true, inputId: "azure-monitor-logs-workspaces-field", value: (_d = query.insightsAnalytics) === null || _d === void 0 ? void 0 : _d.resultFormat, disabled: true, options: FORMAT_OPTIONS, onChange: function () { }, width: 38 })),
        React.createElement(Space, { v: 2 }),
        React.createElement(Alert, { severity: "info", title: "Deprecated" }, "Insights Analytics is deprecated and is now read only. Migrate your queries to Logs to make changes.")));
};
export default InsightsAnalyticsEditor;
//# sourceMappingURL=index.js.map
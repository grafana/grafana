import { __assign, __makeTemplateObject } from "tslib";
import { css } from '@emotion/css';
import { updateDatasourcePluginJsonDataOption, } from '@grafana/data';
import { DataSourcePicker } from '@grafana/runtime';
import { InlineField, InlineFieldRow, Input, TagsInput, useStyles, InlineSwitch } from '@grafana/ui';
import React from 'react';
export function TraceToLogsSettings(_a) {
    var _b, _c, _d, _e, _f, _g, _h;
    var options = _a.options, onOptionsChange = _a.onOptionsChange;
    var styles = useStyles(getStyles);
    return (React.createElement("div", { className: css({ width: '100%' }) },
        React.createElement("h3", { className: "page-heading" }, "Trace to logs"),
        React.createElement("div", { className: styles.infoText }, "Trace to logs let's you navigate from a trace span to the selected data source's log."),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { tooltip: "The data source the trace is going to navigate to", label: "Data source", labelWidth: 26 },
                React.createElement(DataSourcePicker, { pluginId: "loki", current: (_b = options.jsonData.tracesToLogs) === null || _b === void 0 ? void 0 : _b.datasourceUid, noDefault: true, width: 40, onChange: function (ds) {
                        var _a;
                        return updateDatasourcePluginJsonDataOption({ onOptionsChange: onOptionsChange, options: options }, 'tracesToLogs', {
                            datasourceUid: ds.uid,
                            tags: (_a = options.jsonData.tracesToLogs) === null || _a === void 0 ? void 0 : _a.tags,
                        });
                    } }))),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { tooltip: "Tags that will be used in the Loki query. Default tags: 'cluster', 'hostname', 'namespace', 'pod'", label: "Tags", labelWidth: 26 },
                React.createElement(TagsInput, { tags: (_c = options.jsonData.tracesToLogs) === null || _c === void 0 ? void 0 : _c.tags, width: 40, onChange: function (tags) {
                        var _a;
                        return updateDatasourcePluginJsonDataOption({ onOptionsChange: onOptionsChange, options: options }, 'tracesToLogs', {
                            datasourceUid: (_a = options.jsonData.tracesToLogs) === null || _a === void 0 ? void 0 : _a.datasourceUid,
                            tags: tags,
                        });
                    } }))),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Span start time shift", labelWidth: 26, grow: true, tooltip: "Shifts the start time of the span. Default 0 (Time units can be used here, for example: 5s, 1m, 3h)" },
                React.createElement(Input, { type: "text", placeholder: "1h", width: 40, onChange: function (v) {
                        return updateDatasourcePluginJsonDataOption({ onOptionsChange: onOptionsChange, options: options }, 'tracesToLogs', __assign(__assign({}, options.jsonData.tracesToLogs), { spanStartTimeShift: v.currentTarget.value }));
                    }, value: ((_d = options.jsonData.tracesToLogs) === null || _d === void 0 ? void 0 : _d.spanStartTimeShift) || '' }))),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Span end time shift", labelWidth: 26, grow: true, tooltip: "Shifts the end time of the span. Default 0 Time units can be used here, for example: 5s, 1m, 3h" },
                React.createElement(Input, { type: "text", placeholder: "1h", width: 40, onChange: function (v) {
                        return updateDatasourcePluginJsonDataOption({ onOptionsChange: onOptionsChange, options: options }, 'tracesToLogs', __assign(__assign({}, options.jsonData.tracesToLogs), { spanEndTimeShift: v.currentTarget.value }));
                    }, value: ((_e = options.jsonData.tracesToLogs) === null || _e === void 0 ? void 0 : _e.spanEndTimeShift) || '' }))),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Filter by Trace ID", labelWidth: 26, grow: true, tooltip: "Filters logs by Trace ID. Appends '|=<trace id>' to the query." },
                React.createElement(InlineSwitch, { value: (_f = options.jsonData.tracesToLogs) === null || _f === void 0 ? void 0 : _f.filterByTraceID, onChange: function (event) {
                        return updateDatasourcePluginJsonDataOption({ onOptionsChange: onOptionsChange, options: options }, 'tracesToLogs', __assign(__assign({}, options.jsonData.tracesToLogs), { filterByTraceID: event.currentTarget.checked }));
                    } }))),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Filter by Span ID", labelWidth: 26, grow: true, tooltip: "Filters logs by Span ID. Appends '|=<span id>' to the query." },
                React.createElement(InlineSwitch, { value: (_g = options.jsonData.tracesToLogs) === null || _g === void 0 ? void 0 : _g.filterBySpanID, onChange: function (event) {
                        return updateDatasourcePluginJsonDataOption({ onOptionsChange: onOptionsChange, options: options }, 'tracesToLogs', __assign(__assign({}, options.jsonData.tracesToLogs), { filterBySpanID: event.currentTarget.checked }));
                    } }))),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Loki Search", labelWidth: 26, grow: true, tooltip: "Use this logs data source to search for traces." },
                React.createElement(InlineSwitch, { defaultChecked: true, value: (_h = options.jsonData.tracesToLogs) === null || _h === void 0 ? void 0 : _h.lokiSearch, onChange: function (event) {
                        return updateDatasourcePluginJsonDataOption({ onOptionsChange: onOptionsChange, options: options }, 'tracesToLogs', __assign(__assign({}, options.jsonData.tracesToLogs), { lokiSearch: event.currentTarget.checked }));
                    } })))));
}
var getStyles = function (theme) { return ({
    infoText: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    padding-bottom: ", ";\n    color: ", ";\n  "], ["\n    padding-bottom: ", ";\n    color: ", ";\n  "])), theme.spacing.md, theme.colors.textSemiWeak),
}); };
var templateObject_1;
//# sourceMappingURL=TraceToLogsSettings.js.map
import { css } from '@emotion/css';
import React from 'react';
import { updateDatasourcePluginJsonDataOption, } from '@grafana/data';
import { ConfigSection } from '@grafana/experimental';
import { Button, InlineField, InlineFieldRow, Input, useStyles2 } from '@grafana/ui';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { ConfigDescriptionLink } from '../ConfigDescriptionLink';
import { IntervalInput } from '../IntervalInput/IntervalInput';
import { TagMappingInput } from '../TraceToLogs/TagMappingInput';
import { getTimeShiftLabel, getTimeShiftTooltip, invalidTimeShiftError } from '../TraceToLogs/TraceToLogsSettings';
export function TraceToMetricsSettings({ options, onOptionsChange }) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: css({ width: '100%' }) },
        React.createElement(InlineFieldRow, { className: styles.row },
            React.createElement(InlineField, { tooltip: "The Prometheus data source the trace is going to navigate to", label: "Data source", labelWidth: 26 },
                React.createElement(DataSourcePicker, { inputId: "trace-to-metrics-data-source-picker", pluginId: "prometheus", current: (_a = options.jsonData.tracesToMetrics) === null || _a === void 0 ? void 0 : _a.datasourceUid, noDefault: true, width: 40, onChange: (ds) => updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'tracesToMetrics', Object.assign(Object.assign({}, options.jsonData.tracesToMetrics), { datasourceUid: ds.uid })) })),
            ((_b = options.jsonData.tracesToMetrics) === null || _b === void 0 ? void 0 : _b.datasourceUid) ? (React.createElement(Button, { type: "button", variant: "secondary", size: "sm", fill: "text", onClick: () => {
                    updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'tracesToMetrics', Object.assign(Object.assign({}, options.jsonData.tracesToMetrics), { datasourceUid: undefined }));
                } }, "Clear")) : null),
        React.createElement(InlineFieldRow, null,
            React.createElement(IntervalInput, { label: getTimeShiftLabel('start'), tooltip: getTimeShiftTooltip('start', '-2m'), value: ((_c = options.jsonData.tracesToMetrics) === null || _c === void 0 ? void 0 : _c.spanStartTimeShift) || '', onChange: (val) => {
                    updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'tracesToMetrics', Object.assign(Object.assign({}, options.jsonData.tracesToMetrics), { spanStartTimeShift: val }));
                }, placeholder: '-2m', isInvalidError: invalidTimeShiftError })),
        React.createElement(InlineFieldRow, null,
            React.createElement(IntervalInput, { label: getTimeShiftLabel('end'), tooltip: getTimeShiftTooltip('end', '2m'), value: ((_d = options.jsonData.tracesToMetrics) === null || _d === void 0 ? void 0 : _d.spanEndTimeShift) || '', onChange: (val) => {
                    updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'tracesToMetrics', Object.assign(Object.assign({}, options.jsonData.tracesToMetrics), { spanEndTimeShift: val }));
                }, placeholder: '2m', isInvalidError: invalidTimeShiftError })),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { tooltip: "Tags that will be used in the metrics query", label: "Tags", labelWidth: 26 },
                React.createElement(TagMappingInput, { values: (_f = (_e = options.jsonData.tracesToMetrics) === null || _e === void 0 ? void 0 : _e.tags) !== null && _f !== void 0 ? _f : [], onChange: (v) => updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'tracesToMetrics', Object.assign(Object.assign({}, options.jsonData.tracesToMetrics), { tags: v })) }))), (_h = (_g = options.jsonData.tracesToMetrics) === null || _g === void 0 ? void 0 : _g.queries) === null || _h === void 0 ? void 0 :
        _h.map((query, i) => (React.createElement("div", { key: i, className: styles.queryRow },
            React.createElement(InlineField, { label: "Link Label", labelWidth: 26, tooltip: "Descriptive label for the linked query" },
                React.createElement(Input, { label: "Link Label", type: "text", allowFullScreen: true, value: query.name, width: 40, onChange: (e) => {
                        var _a, _b;
                        let newQueries = (_b = (_a = options.jsonData.tracesToMetrics) === null || _a === void 0 ? void 0 : _a.queries.slice()) !== null && _b !== void 0 ? _b : [];
                        newQueries[i].name = e.currentTarget.value;
                        updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'tracesToMetrics', Object.assign(Object.assign({}, options.jsonData.tracesToMetrics), { queries: newQueries }));
                    } })),
            React.createElement(InlineField, { label: "Query", labelWidth: 10, tooltip: "The Prometheus query that will run when navigating from a trace to metrics. Interpolate tags using the `$__tags` keyword", grow: true },
                React.createElement(Input, { label: "Query", type: "text", allowFullScreen: true, value: query.query, onChange: (e) => {
                        var _a, _b;
                        let newQueries = (_b = (_a = options.jsonData.tracesToMetrics) === null || _a === void 0 ? void 0 : _a.queries.slice()) !== null && _b !== void 0 ? _b : [];
                        newQueries[i].query = e.currentTarget.value;
                        updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'tracesToMetrics', Object.assign(Object.assign({}, options.jsonData.tracesToMetrics), { queries: newQueries }));
                    } })),
            React.createElement(Button, { variant: "destructive", title: "Remove query", icon: "times", type: "button", onClick: () => {
                    var _a;
                    let newQueries = (_a = options.jsonData.tracesToMetrics) === null || _a === void 0 ? void 0 : _a.queries.slice();
                    newQueries === null || newQueries === void 0 ? void 0 : newQueries.splice(i, 1);
                    updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'tracesToMetrics', Object.assign(Object.assign({}, options.jsonData.tracesToMetrics), { queries: newQueries }));
                } })))),
        React.createElement(Button, { variant: "secondary", title: "Add query", icon: "plus", type: "button", onClick: () => {
                var _a, _b;
                updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'tracesToMetrics', Object.assign(Object.assign({}, options.jsonData.tracesToMetrics), { queries: [...((_b = (_a = options.jsonData.tracesToMetrics) === null || _a === void 0 ? void 0 : _a.queries) !== null && _b !== void 0 ? _b : []), { query: '' }] }));
            } }, "Add query")));
}
export const TraceToMetricsSection = ({ options, onOptionsChange }) => {
    return (React.createElement(ConfigSection, { title: "Trace to metrics", description: React.createElement(ConfigDescriptionLink, { description: "Navigate from a trace span to the selected data source's metrics.", suffix: `${options.type}/#trace-to-metrics`, feature: "trace to metrics" }), isCollapsible: true, isInitiallyOpen: true },
        React.createElement(TraceToMetricsSettings, { options: options, onOptionsChange: onOptionsChange })));
};
const getStyles = (theme) => ({
    infoText: css `
    padding-bottom: ${theme.spacing(2)};
    color: ${theme.colors.text.secondary};
  `,
    row: css `
    label: row;
    align-items: baseline;
  `,
    queryRow: css `
    label: queryRow;
    display: flex;
    flex-flow: wrap;
  `,
});
//# sourceMappingURL=TraceToMetricsSettings.js.map
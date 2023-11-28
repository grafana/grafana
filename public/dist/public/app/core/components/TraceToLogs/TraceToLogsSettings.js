import { css } from '@emotion/css';
import React, { useCallback, useMemo } from 'react';
import { ConfigSection } from '@grafana/experimental';
import { InlineField, InlineFieldRow, Input, InlineSwitch } from '@grafana/ui';
import { ConfigDescriptionLink } from 'app/core/components/ConfigDescriptionLink';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { IntervalInput } from '../IntervalInput/IntervalInput';
import { TagMappingInput } from './TagMappingInput';
/**
 * Gets new version of the traceToLogs config from the json data either returning directly or transforming the old
 * version to new and returning that.
 */
export function getTraceToLogsOptions(data) {
    var _a;
    if (data === null || data === void 0 ? void 0 : data.tracesToLogsV2) {
        return data.tracesToLogsV2;
    }
    if (!(data === null || data === void 0 ? void 0 : data.tracesToLogs)) {
        return undefined;
    }
    const traceToLogs = {
        customQuery: false,
    };
    traceToLogs.datasourceUid = data.tracesToLogs.datasourceUid;
    traceToLogs.tags = data.tracesToLogs.mapTagNamesEnabled
        ? data.tracesToLogs.mappedTags
        : (_a = data.tracesToLogs.tags) === null || _a === void 0 ? void 0 : _a.map((tag) => ({ key: tag }));
    traceToLogs.filterByTraceID = data.tracesToLogs.filterByTraceID;
    traceToLogs.filterBySpanID = data.tracesToLogs.filterBySpanID;
    traceToLogs.spanStartTimeShift = data.tracesToLogs.spanStartTimeShift;
    traceToLogs.spanEndTimeShift = data.tracesToLogs.spanEndTimeShift;
    return traceToLogs;
}
export function TraceToLogsSettings({ options, onOptionsChange }) {
    const supportedDataSourceTypes = [
        'loki',
        'elasticsearch',
        'grafana-splunk-datasource',
        'grafana-opensearch-datasource',
        'grafana-falconlogscale-datasource',
        'googlecloud-logging-datasource', // external
    ];
    const traceToLogs = useMemo(() => getTraceToLogsOptions(options.jsonData) || { customQuery: false }, [options.jsonData]);
    const { query = '', tags, customQuery } = traceToLogs;
    const updateTracesToLogs = useCallback((value) => {
        // Cannot use updateDatasourcePluginJsonDataOption here as we need to update 2 keys, and they would overwrite each
        // other as updateDatasourcePluginJsonDataOption isn't synchronized
        onOptionsChange(Object.assign(Object.assign({}, options), { jsonData: Object.assign(Object.assign({}, options.jsonData), { tracesToLogsV2: Object.assign(Object.assign({}, traceToLogs), value), tracesToLogs: undefined }) }));
    }, [onOptionsChange, options, traceToLogs]);
    return (React.createElement("div", { className: css({ width: '100%' }) },
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { tooltip: "The logs data source the trace is going to navigate to", label: "Data source", labelWidth: 26 },
                React.createElement(DataSourcePicker, { inputId: "trace-to-logs-data-source-picker", filter: (ds) => supportedDataSourceTypes.includes(ds.type), current: traceToLogs.datasourceUid, noDefault: true, width: 40, onChange: (ds) => updateTracesToLogs({
                        datasourceUid: ds.uid,
                    }) }))),
        React.createElement(InlineFieldRow, null,
            React.createElement(IntervalInput, { label: getTimeShiftLabel('start'), tooltip: getTimeShiftTooltip('start', '0'), value: traceToLogs.spanStartTimeShift || '', onChange: (val) => {
                    updateTracesToLogs({ spanStartTimeShift: val });
                }, isInvalidError: invalidTimeShiftError })),
        React.createElement(InlineFieldRow, null,
            React.createElement(IntervalInput, { label: getTimeShiftLabel('end'), tooltip: getTimeShiftTooltip('end', '0'), value: traceToLogs.spanEndTimeShift || '', onChange: (val) => {
                    updateTracesToLogs({ spanEndTimeShift: val });
                }, isInvalidError: invalidTimeShiftError })),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { tooltip: "Tags that will be used in the query. Default tags: 'cluster', 'hostname', 'namespace', 'pod', 'service.name', 'service.namespace'", label: "Tags", labelWidth: 26 },
                React.createElement(TagMappingInput, { values: tags !== null && tags !== void 0 ? tags : [], onChange: (v) => updateTracesToLogs({ tags: v }) }))),
        React.createElement(IdFilter, { disabled: customQuery, type: 'trace', id: 'filterByTraceID', value: Boolean(traceToLogs.filterByTraceID), onChange: (val) => updateTracesToLogs({ filterByTraceID: val }) }),
        React.createElement(IdFilter, { disabled: customQuery, type: 'span', id: 'filterBySpanID', value: Boolean(traceToLogs.filterBySpanID), onChange: (val) => updateTracesToLogs({ filterBySpanID: val }) }),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { tooltip: "Use a custom query with the possibility to interpolate variables from the trace or span", label: "Use custom query", labelWidth: 26 },
                React.createElement(InlineSwitch, { id: 'customQuerySwitch', value: customQuery, onChange: (event) => updateTracesToLogs({ customQuery: event.currentTarget.checked }) }))),
        customQuery && (React.createElement(InlineField, { label: "Query", labelWidth: 26, tooltip: "The query that will run when navigating from a trace to logs data source. Interpolate tags using the `$__tags` keyword", grow: true },
            React.createElement(Input, { label: "Query", type: "text", allowFullScreen: true, value: query, onChange: (e) => updateTracesToLogs({ query: e.currentTarget.value }) })))));
}
function IdFilter(props) {
    return (React.createElement(InlineFieldRow, null,
        React.createElement(InlineField, { disabled: props.disabled, label: `Filter by ${props.type} ID`, labelWidth: 26, grow: true, tooltip: `Filters logs by ${props.type} ID` },
            React.createElement(InlineSwitch, { id: props.id, value: props.value, onChange: (event) => props.onChange(event.currentTarget.checked) }))));
}
export const getTimeShiftLabel = (type) => {
    return `Span ${type} time shift`;
};
export const getTimeShiftTooltip = (type, defaultVal) => {
    return `Shifts the ${type} time of the span. Default: ${defaultVal} (Time units can be used here, for example: 5s, -1m, 3h)`;
};
export const invalidTimeShiftError = 'Invalid time shift. See tooltip for examples.';
export const TraceToLogsSection = ({ options, onOptionsChange }) => {
    return (React.createElement(ConfigSection, { title: "Trace to logs", description: React.createElement(ConfigDescriptionLink, { description: "Navigate from a trace span to the selected data source's logs.", suffix: `${options.type}/#trace-to-logs`, feature: "trace to logs" }), isCollapsible: true, isInitiallyOpen: true },
        React.createElement(TraceToLogsSettings, { options: options, onOptionsChange: onOptionsChange })));
};
//# sourceMappingURL=TraceToLogsSettings.js.map
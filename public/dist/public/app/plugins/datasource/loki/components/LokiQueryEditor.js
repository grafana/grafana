import { __assign } from "tslib";
// Libraries
import React from 'react';
// Types
import { InlineFormLabel } from '@grafana/ui';
import { LokiQueryField } from './LokiQueryField';
import { LokiOptionFields } from './LokiOptionFields';
export function LokiQueryEditor(props) {
    var _a;
    var query = props.query, data = props.data, datasource = props.datasource, onChange = props.onChange, onRunQuery = props.onRunQuery, range = props.range;
    var onLegendChange = function (e) {
        var nextQuery = __assign(__assign({}, query), { legendFormat: e.currentTarget.value });
        onChange(nextQuery);
    };
    var legendField = (React.createElement("div", { className: "gf-form-inline" },
        React.createElement("div", { className: "gf-form" },
            React.createElement(InlineFormLabel, { width: 6, tooltip: "Controls the name of the time series, using name or pattern. For example\n        {{hostname}} will be replaced with label value for the label hostname. The legend only applies to metric queries." }, "Legend"),
            React.createElement("input", { type: "text", className: "gf-form-input", placeholder: "legend format", value: query.legendFormat || '', onChange: onLegendChange, onBlur: onRunQuery }))));
    return (React.createElement(LokiQueryField, { datasource: datasource, query: query, onChange: onChange, onRunQuery: onRunQuery, onBlur: onRunQuery, history: [], data: data, "data-testid": testIds.editor, range: range, ExtraFieldElement: React.createElement(React.Fragment, null,
            React.createElement(LokiOptionFields, { queryType: query.instant ? 'instant' : 'range', lineLimitValue: ((_a = query === null || query === void 0 ? void 0 : query.maxLines) === null || _a === void 0 ? void 0 : _a.toString()) || '', resolution: (query === null || query === void 0 ? void 0 : query.resolution) || 1, query: query, onRunQuery: onRunQuery, onChange: onChange, runOnBlur: true }),
            legendField) }));
}
export var testIds = {
    editor: 'loki-editor',
};
//# sourceMappingURL=LokiQueryEditor.js.map
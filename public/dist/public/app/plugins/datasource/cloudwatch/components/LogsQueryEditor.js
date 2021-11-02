import { __assign, __makeTemplateObject } from "tslib";
// Libraries
import React, { memo } from 'react';
import { InlineFormLabel } from '@grafana/ui';
import { CloudWatchLogsQueryField } from './LogsQueryField';
import CloudWatchLink from './CloudWatchLink';
import { css } from '@emotion/css';
var labelClass = css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  margin-left: 3px;\n  flex-grow: 0;\n"], ["\n  margin-left: 3px;\n  flex-grow: 0;\n"])));
export var CloudWatchLogsQueryEditor = memo(function CloudWatchLogsQueryEditor(props) {
    var _a, _b;
    var query = props.query, data = props.data, datasource = props.datasource, onRunQuery = props.onRunQuery, onChange = props.onChange, exploreId = props.exploreId, _c = props.allowCustomValue, allowCustomValue = _c === void 0 ? false : _c;
    var absolute;
    if ((_b = (_a = data === null || data === void 0 ? void 0 : data.request) === null || _a === void 0 ? void 0 : _a.range) === null || _b === void 0 ? void 0 : _b.from) {
        var range = data.request.range;
        absolute = {
            from: range.from.valueOf(),
            to: range.to.valueOf(),
        };
    }
    else {
        absolute = {
            from: Date.now() - 10000,
            to: Date.now(),
        };
    }
    return (React.createElement(CloudWatchLogsQueryField, { exploreId: exploreId, datasource: datasource, query: query, onBlur: function () { }, onChange: function (val) { return onChange(__assign(__assign({}, val), { queryMode: 'Logs' })); }, onRunQuery: onRunQuery, history: [], data: data, absoluteRange: absolute, allowCustomValue: allowCustomValue, ExtraFieldElement: React.createElement(InlineFormLabel, { className: "gf-form-label--btn " + labelClass, width: "auto", tooltip: "Link to Graph in AWS" },
            React.createElement(CloudWatchLink, { query: query, panelData: data, datasource: datasource })) }));
});
export default CloudWatchLogsQueryEditor;
var templateObject_1;
//# sourceMappingURL=LogsQueryEditor.js.map
import { __assign, __makeTemplateObject } from "tslib";
// Libraries
import React, { memo } from 'react';
import { css, cx } from '@emotion/css';
import { map } from 'lodash';
// Types
import { InlineFormLabel, RadioButtonGroup, InlineField, Input, Select } from '@grafana/ui';
var queryTypeOptions = [
    { value: 'range', label: 'Range', description: 'Run query over a range of time.' },
    {
        value: 'instant',
        label: 'Instant',
        description: 'Run query against a single point in time. For this query, the "To" time is used.',
    },
];
export var DEFAULT_RESOLUTION = {
    value: 1,
    label: '1/1',
};
var RESOLUTION_OPTIONS = [DEFAULT_RESOLUTION].concat(map([2, 3, 4, 5, 10], function (value) { return ({
    value: value,
    label: '1/' + value,
}); }));
export function LokiOptionFields(props) {
    var lineLimitValue = props.lineLimitValue, resolution = props.resolution, queryType = props.queryType, query = props.query, onRunQuery = props.onRunQuery, runOnBlur = props.runOnBlur, onChange = props.onChange;
    function onChangeQueryLimit(value) {
        var nextQuery = __assign(__assign({}, query), { maxLines: preprocessMaxLines(value) });
        onChange(nextQuery);
    }
    function onQueryTypeChange(value) {
        var nextQuery;
        if (value === 'instant') {
            nextQuery = __assign(__assign({}, query), { instant: true, range: false });
        }
        else {
            nextQuery = __assign(__assign({}, query), { instant: false, range: true });
        }
        onChange(nextQuery);
    }
    function preprocessMaxLines(value) {
        if (value.length === 0) {
            // empty input - falls back to dataSource.maxLines limit
            return NaN;
        }
        else if (value.length > 0 && (isNaN(+value) || +value < 0)) {
            // input with at least 1 character and that is either incorrect (value in the input field is not a number) or negative
            // falls back to the limit of 0 lines
            return 0;
        }
        else {
            // default case - correct input
            return +value;
        }
    }
    function onMaxLinesChange(e) {
        if (query.maxLines !== preprocessMaxLines(e.currentTarget.value)) {
            onChangeQueryLimit(e.currentTarget.value);
        }
    }
    function onReturnKeyDown(e) {
        if (e.key === 'Enter') {
            onRunQuery();
        }
    }
    function onResolutionChange(option) {
        var nextQuery = __assign(__assign({}, query), { resolution: option.value });
        onChange(nextQuery);
    }
    return (React.createElement("div", { "aria-label": "Loki extra field", className: "gf-form-inline" },
        React.createElement("div", { "data-testid": "queryTypeField", className: cx('gf-form explore-input-margin', css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n            flex-wrap: nowrap;\n          "], ["\n            flex-wrap: nowrap;\n          "])))), "aria-label": "Query type field" },
            React.createElement(InlineFormLabel, { width: "auto" }, "Query type"),
            React.createElement(RadioButtonGroup, { options: queryTypeOptions, value: queryType, onChange: function (type) {
                    onQueryTypeChange(type);
                    if (runOnBlur) {
                        onRunQuery();
                    }
                } })),
        React.createElement("div", { "data-testid": "lineLimitField", className: cx('gf-form', css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n            flex-wrap: nowrap;\n          "], ["\n            flex-wrap: nowrap;\n          "])))), "aria-label": "Line limit field" },
            React.createElement(InlineField, { label: "Line limit", tooltip: 'Upper limit for number of log lines returned by query.' },
                React.createElement(Input, { className: "width-4", placeholder: "auto", type: "number", min: 0, onChange: onMaxLinesChange, onKeyDown: onReturnKeyDown, value: lineLimitValue, onBlur: function () {
                        if (runOnBlur) {
                            onRunQuery();
                        }
                    } })),
            React.createElement(InlineField, { label: "Resolution", tooltip: 'Resolution 1/1 sets step parameter of Loki metrics range queries such that each pixel corresponds to one data point. For better performance, lower resolutions can be picked. 1/2 only retrieves a data point for every other pixel, and 1/10 retrieves one data point per 10 pixels.' },
                React.createElement(Select, { isSearchable: false, onChange: onResolutionChange, options: RESOLUTION_OPTIONS, value: resolution })))));
}
export default memo(LokiOptionFields);
var templateObject_1, templateObject_2;
//# sourceMappingURL=LokiOptionFields.js.map
import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { Segment } from '@grafana/ui';
import { describeMetric } from '../utils';
var noWrap = css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  white-space: nowrap;\n"], ["\n  white-space: nowrap;\n"])));
var toOption = function (metric) { return ({
    label: describeMetric(metric),
    value: metric,
}); };
var toOptions = function (metrics) { return metrics.map(toOption); };
export var MetricPicker = function (_a) {
    var options = _a.options, onChange = _a.onChange, className = _a.className, value = _a.value;
    var selectedOption = options.find(function (option) { return option.id === value; });
    return (React.createElement(Segment, { className: cx(className, noWrap), options: toOptions(options), onChange: onChange, placeholder: "Select Metric", value: !!selectedOption ? toOption(selectedOption) : undefined }));
};
var templateObject_1;
//# sourceMappingURL=MetricPicker.js.map
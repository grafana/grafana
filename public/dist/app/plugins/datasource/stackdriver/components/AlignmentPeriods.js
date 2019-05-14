import * as tslib_1 from "tslib";
import React from 'react';
import kbn from 'app/core/utils/kbn';
import { MetricSelect } from 'app/core/components/Select/MetricSelect';
import { alignmentPeriods, alignOptions } from '../constants';
export var AlignmentPeriods = function (_a) {
    var alignmentPeriod = _a.alignmentPeriod, templateSrv = _a.templateSrv, onChange = _a.onChange, perSeriesAligner = _a.perSeriesAligner, usedAlignmentPeriod = _a.usedAlignmentPeriod;
    var alignment = alignOptions.find(function (ap) { return ap.value === templateSrv.replace(perSeriesAligner); });
    var formatAlignmentText = kbn.secondsToHms(usedAlignmentPeriod) + " interval (" + (alignment ? alignment.text : '') + ")";
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: "gf-form-inline" },
            React.createElement("div", { className: "gf-form" },
                React.createElement("label", { className: "gf-form-label query-keyword width-9" }, "Alignment Period"),
                React.createElement(MetricSelect, { onChange: onChange, value: alignmentPeriod, variables: templateSrv.variables, options: [
                        {
                            label: 'Alignment options',
                            expanded: true,
                            options: alignmentPeriods.map(function (ap) { return (tslib_1.__assign({}, ap, { label: ap.text })); }),
                        },
                    ], placeholder: "Select Alignment", className: "width-15" })),
            React.createElement("div", { className: "gf-form gf-form--grow" }, usedAlignmentPeriod && React.createElement("label", { className: "gf-form-label gf-form-label--grow" }, formatAlignmentText)))));
};
//# sourceMappingURL=AlignmentPeriods.js.map
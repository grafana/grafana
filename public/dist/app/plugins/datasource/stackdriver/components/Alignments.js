import React from 'react';
import { MetricSelect } from 'app/core/components/Select/MetricSelect';
export var Alignments = function (_a) {
    var perSeriesAligner = _a.perSeriesAligner, templateSrv = _a.templateSrv, onChange = _a.onChange, alignOptions = _a.alignOptions;
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: "gf-form-group" },
            React.createElement("div", { className: "gf-form offset-width-9" },
                React.createElement("label", { className: "gf-form-label query-keyword width-15" }, "Aligner"),
                React.createElement(MetricSelect, { onChange: onChange, value: perSeriesAligner, variables: templateSrv.variables, options: alignOptions, placeholder: "Select Alignment", className: "width-15" })))));
};
//# sourceMappingURL=Alignments.js.map
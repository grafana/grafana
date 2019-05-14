import * as tslib_1 from "tslib";
import React from 'react';
import { Project } from './Project';
var Help = /** @class */ (function (_super) {
    tslib_1.__extends(Help, _super);
    function Help() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            displayHelp: false,
            displaRawQuery: false,
        };
        _this.onHelpClicked = function () {
            _this.setState({ displayHelp: !_this.state.displayHelp });
        };
        _this.onRawQueryClicked = function () {
            _this.setState({ displaRawQuery: !_this.state.displaRawQuery });
        };
        return _this;
    }
    Help.prototype.shouldComponentUpdate = function (nextProps) {
        return nextProps.metricDescriptor !== null;
    };
    Help.prototype.render = function () {
        var _a = this.state, displayHelp = _a.displayHelp, displaRawQuery = _a.displaRawQuery;
        var _b = this.props, datasource = _b.datasource, rawQuery = _b.rawQuery, lastQueryError = _b.lastQueryError;
        return (React.createElement(React.Fragment, null,
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement(Project, { datasource: datasource }),
                React.createElement("div", { className: "gf-form", onClick: this.onHelpClicked },
                    React.createElement("label", { className: "gf-form-label query-keyword pointer" },
                        "Show Help ",
                        React.createElement("i", { className: "fa fa-caret-" + (displayHelp ? 'down' : 'right') }))),
                rawQuery && (React.createElement("div", { className: "gf-form", onClick: this.onRawQueryClicked },
                    React.createElement("label", { className: "gf-form-label query-keyword" },
                        "Raw Query ",
                        React.createElement("i", { className: "fa fa-caret-" + (displaRawQuery ? 'down' : 'right'), "ng-show": "ctrl.showHelp" })))),
                React.createElement("div", { className: "gf-form gf-form--grow" },
                    React.createElement("div", { className: "gf-form-label gf-form-label--grow" }))),
            rawQuery && displaRawQuery && (React.createElement("div", { className: "gf-form" },
                React.createElement("pre", { className: "gf-form-pre" }, rawQuery))),
            displayHelp && (React.createElement("div", { className: "gf-form grafana-info-box", style: { padding: 0 } },
                React.createElement("pre", { className: "gf-form-pre alert alert-info", style: { marginRight: 0 } },
                    React.createElement("h5", null, "Alias Patterns"),
                    "Format the legend keys any way you want by using alias patterns. Format the legend keys any way you want by using alias patterns.",
                    React.createElement("br", null),
                    " ",
                    React.createElement("br", null),
                    "Example:",
                    React.createElement("code", null, "" + '{{metricDescriptor.name}} - {{metricDescriptor.label.instance_name}}'),
                    React.createElement("br", null),
                    "Result: \u00A0\u00A0",
                    React.createElement("code", null, "cpu/usage_time - server1-europe-west-1"),
                    React.createElement("br", null),
                    React.createElement("br", null),
                    React.createElement("strong", null, "Patterns"),
                    React.createElement("br", null),
                    React.createElement("ul", null,
                        React.createElement("li", null,
                            React.createElement("code", null, "" + '{{metricDescriptor.type}}'),
                            " = metric type e.g. compute.googleapis.com/instance/cpu/usage_time"),
                        React.createElement("li", null,
                            React.createElement("code", null, "" + '{{metricDescriptor.name}}'),
                            " = name part of metric e.g. instance/cpu/usage_time"),
                        React.createElement("li", null,
                            React.createElement("code", null, "" + '{{metricDescriptor.service}}'),
                            " = service part of metric e.g. compute"),
                        React.createElement("li", null,
                            React.createElement("code", null, "" + '{{metricDescriptor.label.label_name}}'),
                            " = Metric label metadata e.g. metricDescriptor.label.instance_name"),
                        React.createElement("li", null,
                            React.createElement("code", null, "" + '{{resource.label.label_name}}'),
                            " = Resource label metadata e.g. resource.label.zone"),
                        React.createElement("li", null,
                            React.createElement("code", null, "" + '{{bucket}}'),
                            " = bucket boundary for distribution metrics when using a heatmap in Grafana"))))),
            lastQueryError && (React.createElement("div", { className: "gf-form" },
                React.createElement("pre", { className: "gf-form-pre alert alert-error" }, lastQueryError)))));
    };
    return Help;
}(React.Component));
export { Help };
//# sourceMappingURL=Help.js.map
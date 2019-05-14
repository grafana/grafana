import * as tslib_1 from "tslib";
import React from 'react';
import { MetricSelect } from 'app/core/components/Select/MetricSelect';
import { getAggregationOptionsByMetric } from '../functions';
var Aggregations = /** @class */ (function (_super) {
    tslib_1.__extends(Aggregations, _super);
    function Aggregations() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            aggOptions: [],
            displayAdvancedOptions: false,
        };
        _this.onToggleDisplayAdvanced = function () {
            _this.setState(function (state) { return ({
                displayAdvancedOptions: !state.displayAdvancedOptions,
            }); });
        };
        return _this;
    }
    Aggregations.prototype.componentDidMount = function () {
        this.setAggOptions(this.props);
    };
    Aggregations.prototype.componentWillReceiveProps = function (nextProps) {
        this.setAggOptions(nextProps);
    };
    Aggregations.prototype.setAggOptions = function (_a) {
        var metricDescriptor = _a.metricDescriptor;
        var aggOptions = [];
        if (metricDescriptor) {
            aggOptions = [
                {
                    label: 'Aggregations',
                    expanded: true,
                    options: getAggregationOptionsByMetric(metricDescriptor.valueType, metricDescriptor.metricKind).map(function (a) { return (tslib_1.__assign({}, a, { label: a.text })); }),
                },
            ];
        }
        this.setState({ aggOptions: aggOptions });
    };
    Aggregations.prototype.render = function () {
        var _a = this.state, displayAdvancedOptions = _a.displayAdvancedOptions, aggOptions = _a.aggOptions;
        var _b = this.props, templateSrv = _b.templateSrv, onChange = _b.onChange, crossSeriesReducer = _b.crossSeriesReducer;
        return (React.createElement(React.Fragment, null,
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement("label", { className: "gf-form-label query-keyword width-9" }, "Aggregation"),
                    React.createElement(MetricSelect, { onChange: onChange, value: crossSeriesReducer, variables: templateSrv.variables, options: aggOptions, placeholder: "Select Reducer", className: "width-15" })),
                React.createElement("div", { className: "gf-form gf-form--grow" },
                    React.createElement("label", { className: "gf-form-label gf-form-label--grow" },
                        React.createElement("a", { onClick: this.onToggleDisplayAdvanced },
                            React.createElement(React.Fragment, null,
                                React.createElement("i", { className: "fa fa-caret-" + (displayAdvancedOptions ? 'down' : 'right') }),
                                " Advanced Options"))))),
            this.props.children(this.state.displayAdvancedOptions)));
    };
    return Aggregations;
}(React.Component));
export { Aggregations };
//# sourceMappingURL=Aggregations.js.map
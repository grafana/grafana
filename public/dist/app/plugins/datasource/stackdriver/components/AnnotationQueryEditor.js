import * as tslib_1 from "tslib";
import React from 'react';
import { Metrics } from './Metrics';
import { Filter } from './Filter';
import { AnnotationsHelp } from './AnnotationsHelp';
var DefaultTarget = {
    defaultProject: 'loading project...',
    metricType: '',
    filters: [],
    metricKind: '',
    valueType: '',
    refId: 'annotationQuery',
    title: '',
    text: '',
};
var AnnotationQueryEditor = /** @class */ (function (_super) {
    tslib_1.__extends(AnnotationQueryEditor, _super);
    function AnnotationQueryEditor() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = DefaultTarget;
        _this.onMetricTypeChange = function (_a) {
            var valueType = _a.valueType, metricKind = _a.metricKind, type = _a.type, unit = _a.unit;
            var onQueryChange = _this.props.onQueryChange;
            _this.setState({
                metricType: type,
                unit: unit,
                valueType: valueType,
                metricKind: metricKind,
            }, function () {
                onQueryChange(_this.state);
            });
        };
        return _this;
    }
    AnnotationQueryEditor.prototype.componentDidMount = function () {
        this.setState(tslib_1.__assign({}, this.props.target));
    };
    AnnotationQueryEditor.prototype.onChange = function (prop, value) {
        var _this = this;
        var _a;
        this.setState((_a = {}, _a[prop] = value, _a), function () {
            _this.props.onQueryChange(_this.state);
        });
    };
    AnnotationQueryEditor.prototype.render = function () {
        var _this = this;
        var _a = this.state, defaultProject = _a.defaultProject, metricType = _a.metricType, filters = _a.filters, refId = _a.refId, title = _a.title, text = _a.text;
        var _b = this.props, datasource = _b.datasource, templateSrv = _b.templateSrv;
        return (React.createElement(React.Fragment, null,
            React.createElement(Metrics, { defaultProject: defaultProject, metricType: metricType, templateSrv: templateSrv, datasource: datasource, onChange: this.onMetricTypeChange }, function (metric) { return (React.createElement(React.Fragment, null,
                React.createElement(Filter, { filtersChanged: function (value) { return _this.onChange('filters', value); }, filters: filters, refId: refId, hideGroupBys: true, templateSrv: templateSrv, datasource: datasource, metricType: metric ? metric.type : '' }))); }),
            React.createElement("div", { className: "gf-form gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement("span", { className: "gf-form-label query-keyword width-9" }, "Title"),
                    React.createElement("input", { type: "text", className: "gf-form-input width-20", value: title, onChange: function (e) { return _this.onChange('title', e.target.value); } })),
                React.createElement("div", { className: "gf-form" },
                    React.createElement("span", { className: "gf-form-label query-keyword width-9" }, "Text"),
                    React.createElement("input", { type: "text", className: "gf-form-input width-20", value: text, onChange: function (e) { return _this.onChange('text', e.target.value); } })),
                React.createElement("div", { className: "gf-form gf-form--grow" },
                    React.createElement("div", { className: "gf-form-label gf-form-label--grow" }))),
            React.createElement(AnnotationsHelp, null)));
    };
    return AnnotationQueryEditor;
}(React.Component));
export { AnnotationQueryEditor };
//# sourceMappingURL=AnnotationQueryEditor.js.map
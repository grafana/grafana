import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import SimpleSelect from './SimpleSelect';
import { getMetricTypes, getLabelKeys, extractServicesFromMetricDescriptors } from '../functions';
import { MetricFindQueryTypes } from '../types';
var StackdriverVariableQueryEditor = /** @class */ (function (_super) {
    tslib_1.__extends(StackdriverVariableQueryEditor, _super);
    function StackdriverVariableQueryEditor(props) {
        var _this = _super.call(this, props) || this;
        _this.queryTypes = [
            { value: MetricFindQueryTypes.Services, name: 'Services' },
            { value: MetricFindQueryTypes.MetricTypes, name: 'Metric Types' },
            { value: MetricFindQueryTypes.LabelKeys, name: 'Label Keys' },
            { value: MetricFindQueryTypes.LabelValues, name: 'Label Values' },
            { value: MetricFindQueryTypes.ResourceTypes, name: 'Resource Types' },
            { value: MetricFindQueryTypes.Aggregations, name: 'Aggregations' },
            { value: MetricFindQueryTypes.Aligners, name: 'Aligners' },
            { value: MetricFindQueryTypes.AlignmentPeriods, name: 'Alignment Periods' },
        ];
        _this.defaults = {
            selectedQueryType: _this.queryTypes[0].value,
            metricDescriptors: [],
            selectedService: '',
            selectedMetricType: '',
            labels: [],
            labelKey: '',
            metricTypes: [],
            services: [],
        };
        _this.state = Object.assign(_this.defaults, _this.props.query);
        return _this;
    }
    StackdriverVariableQueryEditor.prototype.componentDidMount = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var metricDescriptors, services, selectedService, _a, metricTypes, selectedMetricType, state, _b;
            var _this = this;
            return tslib_1.__generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, this.props.datasource.getMetricTypes(this.props.datasource.projectName)];
                    case 1:
                        metricDescriptors = _c.sent();
                        services = extractServicesFromMetricDescriptors(metricDescriptors).map(function (m) { return ({
                            value: m.service,
                            name: m.serviceShortName,
                        }); });
                        selectedService = '';
                        if (services.some(function (s) { return s.value === _this.props.templateSrv.replace(_this.state.selectedService); })) {
                            selectedService = this.state.selectedService;
                        }
                        else if (services && services.length > 0) {
                            selectedService = services[0].value;
                        }
                        _a = getMetricTypes(metricDescriptors, this.state.selectedMetricType, this.props.templateSrv.replace(this.state.selectedMetricType), this.props.templateSrv.replace(selectedService)), metricTypes = _a.metricTypes, selectedMetricType = _a.selectedMetricType;
                        _b = [{ services: services,
                                selectedService: selectedService,
                                metricTypes: metricTypes,
                                selectedMetricType: selectedMetricType,
                                metricDescriptors: metricDescriptors }];
                        return [4 /*yield*/, this.getLabels(selectedMetricType)];
                    case 2:
                        state = tslib_1.__assign.apply(void 0, _b.concat([(_c.sent())]));
                        this.setState(state);
                        return [2 /*return*/];
                }
            });
        });
    };
    StackdriverVariableQueryEditor.prototype.onQueryTypeChange = function (event) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var state, _a;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = [{ selectedQueryType: event.target.value }];
                        return [4 /*yield*/, this.getLabels(this.state.selectedMetricType, event.target.value)];
                    case 1:
                        state = tslib_1.__assign.apply(void 0, _a.concat([(_b.sent())]));
                        this.setState(state);
                        return [2 /*return*/];
                }
            });
        });
    };
    StackdriverVariableQueryEditor.prototype.onServiceChange = function (event) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var _a, metricTypes, selectedMetricType, state, _b;
            return tslib_1.__generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = getMetricTypes(this.state.metricDescriptors, this.state.selectedMetricType, this.props.templateSrv.replace(this.state.selectedMetricType), this.props.templateSrv.replace(event.target.value)), metricTypes = _a.metricTypes, selectedMetricType = _a.selectedMetricType;
                        _b = [{ selectedService: event.target.value, metricTypes: metricTypes,
                                selectedMetricType: selectedMetricType }];
                        return [4 /*yield*/, this.getLabels(selectedMetricType)];
                    case 1:
                        state = tslib_1.__assign.apply(void 0, _b.concat([(_c.sent())]));
                        this.setState(state);
                        return [2 /*return*/];
                }
            });
        });
    };
    StackdriverVariableQueryEditor.prototype.onMetricTypeChange = function (event) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var state, _a;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = [{ selectedMetricType: event.target.value }];
                        return [4 /*yield*/, this.getLabels(event.target.value)];
                    case 1:
                        state = tslib_1.__assign.apply(void 0, _a.concat([(_b.sent())]));
                        this.setState(state);
                        return [2 /*return*/];
                }
            });
        });
    };
    StackdriverVariableQueryEditor.prototype.onLabelKeyChange = function (event) {
        this.setState({ labelKey: event.target.value });
    };
    StackdriverVariableQueryEditor.prototype.componentDidUpdate = function () {
        var _this = this;
        var _a = this.state, metricDescriptors = _a.metricDescriptors, labels = _a.labels, metricTypes = _a.metricTypes, services = _a.services, queryModel = tslib_1.__rest(_a, ["metricDescriptors", "labels", "metricTypes", "services"]);
        var query = this.queryTypes.find(function (q) { return q.value === _this.state.selectedQueryType; });
        this.props.onChange(queryModel, "Stackdriver - " + query.name);
    };
    StackdriverVariableQueryEditor.prototype.getLabels = function (selectedMetricType, selectedQueryType) {
        if (selectedQueryType === void 0) { selectedQueryType = this.state.selectedQueryType; }
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var result, labels, labelKey;
            var _this = this;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        result = { labels: this.state.labels, labelKey: this.state.labelKey };
                        if (!(selectedMetricType && selectedQueryType === MetricFindQueryTypes.LabelValues)) return [3 /*break*/, 2];
                        return [4 /*yield*/, getLabelKeys(this.props.datasource, selectedMetricType)];
                    case 1:
                        labels = _a.sent();
                        labelKey = labels.some(function (l) { return l === _this.props.templateSrv.replace(_this.state.labelKey); })
                            ? this.state.labelKey
                            : labels[0];
                        result = { labels: labels, labelKey: labelKey };
                        _a.label = 2;
                    case 2: return [2 /*return*/, result];
                }
            });
        });
    };
    StackdriverVariableQueryEditor.prototype.insertTemplateVariables = function (options) {
        var templateVariables = this.props.templateSrv.variables.map(function (v) { return ({ name: "$" + v.name, value: "$" + v.name }); });
        return tslib_1.__spread(templateVariables, options);
    };
    StackdriverVariableQueryEditor.prototype.renderQueryTypeSwitch = function (queryType) {
        var _this = this;
        switch (queryType) {
            case MetricFindQueryTypes.MetricTypes:
                return (React.createElement(SimpleSelect, { value: this.state.selectedService, options: this.insertTemplateVariables(this.state.services), onValueChange: function (e) { return _this.onServiceChange(e); }, label: "Service" }));
            case MetricFindQueryTypes.LabelKeys:
            case MetricFindQueryTypes.LabelValues:
            case MetricFindQueryTypes.ResourceTypes:
                return (React.createElement(React.Fragment, null,
                    React.createElement(SimpleSelect, { value: this.state.selectedService, options: this.insertTemplateVariables(this.state.services), onValueChange: function (e) { return _this.onServiceChange(e); }, label: "Service" }),
                    React.createElement(SimpleSelect, { value: this.state.selectedMetricType, options: this.insertTemplateVariables(this.state.metricTypes), onValueChange: function (e) { return _this.onMetricTypeChange(e); }, label: "Metric Type" }),
                    queryType === MetricFindQueryTypes.LabelValues && (React.createElement(SimpleSelect, { value: this.state.labelKey, options: this.insertTemplateVariables(this.state.labels.map(function (l) { return ({ value: l, name: l }); })), onValueChange: function (e) { return _this.onLabelKeyChange(e); }, label: "Label Key" }))));
            case MetricFindQueryTypes.Aligners:
            case MetricFindQueryTypes.Aggregations:
                return (React.createElement(React.Fragment, null,
                    React.createElement(SimpleSelect, { value: this.state.selectedService, options: this.insertTemplateVariables(this.state.services), onValueChange: function (e) { return _this.onServiceChange(e); }, label: "Service" }),
                    React.createElement(SimpleSelect, { value: this.state.selectedMetricType, options: this.insertTemplateVariables(this.state.metricTypes), onValueChange: function (e) { return _this.onMetricTypeChange(e); }, label: "Metric Type" })));
            default:
                return '';
        }
    };
    StackdriverVariableQueryEditor.prototype.render = function () {
        var _this = this;
        return (React.createElement(React.Fragment, null,
            React.createElement(SimpleSelect, { value: this.state.selectedQueryType, options: this.queryTypes, onValueChange: function (e) { return _this.onQueryTypeChange(e); }, label: "Query Type" }),
            this.renderQueryTypeSwitch(this.state.selectedQueryType)));
    };
    return StackdriverVariableQueryEditor;
}(PureComponent));
export { StackdriverVariableQueryEditor };
//# sourceMappingURL=VariableQueryEditor.js.map
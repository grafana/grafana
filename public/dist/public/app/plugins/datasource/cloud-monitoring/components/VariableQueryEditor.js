import { __assign, __awaiter, __extends, __generator, __read, __rest, __spreadArray } from "tslib";
import React, { PureComponent } from 'react';
import { getTemplateSrv } from '@grafana/runtime';
import { VariableQueryField } from './';
import { extractServicesFromMetricDescriptors, getLabelKeys, getMetricTypes } from '../functions';
import { MetricFindQueryTypes, } from '../types';
var CloudMonitoringVariableQueryEditor = /** @class */ (function (_super) {
    __extends(CloudMonitoringVariableQueryEditor, _super);
    function CloudMonitoringVariableQueryEditor(props) {
        var _this = _super.call(this, props) || this;
        _this.queryTypes = [
            { value: MetricFindQueryTypes.Projects, label: 'Projects' },
            { value: MetricFindQueryTypes.Services, label: 'Services' },
            { value: MetricFindQueryTypes.MetricTypes, label: 'Metric Types' },
            { value: MetricFindQueryTypes.LabelKeys, label: 'Label Keys' },
            { value: MetricFindQueryTypes.LabelValues, label: 'Label Values' },
            { value: MetricFindQueryTypes.ResourceTypes, label: 'Resource Types' },
            { value: MetricFindQueryTypes.Aggregations, label: 'Aggregations' },
            { value: MetricFindQueryTypes.Aligners, label: 'Aligners' },
            { value: MetricFindQueryTypes.AlignmentPeriods, label: 'Alignment Periods' },
            { value: MetricFindQueryTypes.Selectors, label: 'Selectors' },
            { value: MetricFindQueryTypes.SLOServices, label: 'SLO Services' },
            { value: MetricFindQueryTypes.SLO, label: 'Service Level Objectives (SLO)' },
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
            sloServices: [],
            selectedSLOService: '',
            projects: [],
            projectName: '',
            loading: true,
        };
        _this.onPropsChange = function () {
            var _a = _this.state, metricDescriptors = _a.metricDescriptors, labels = _a.labels, metricTypes = _a.metricTypes, services = _a.services, queryModel = __rest(_a, ["metricDescriptors", "labels", "metricTypes", "services"]);
            _this.props.onChange(__assign(__assign({}, queryModel), { refId: 'CloudMonitoringVariableQueryEditor-VariableQuery' }));
        };
        _this.state = Object.assign(_this.defaults, { projectName: _this.props.datasource.getDefaultProject() }, _this.props.query);
        return _this;
    }
    CloudMonitoringVariableQueryEditor.prototype.componentDidMount = function () {
        return __awaiter(this, void 0, void 0, function () {
            var projects, metricDescriptors, services, selectedService, _a, metricTypes, selectedMetricType, sloServices, state, _b;
            var _this = this;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, this.props.datasource.getProjects()];
                    case 1:
                        projects = (_c.sent());
                        return [4 /*yield*/, this.props.datasource.getMetricTypes(this.props.query.projectName || this.props.datasource.getDefaultProject())];
                    case 2:
                        metricDescriptors = _c.sent();
                        services = extractServicesFromMetricDescriptors(metricDescriptors).map(function (m) { return ({
                            value: m.service,
                            label: m.serviceShortName,
                        }); });
                        selectedService = '';
                        if (services.some(function (s) { return s.value === getTemplateSrv().replace(_this.state.selectedService); })) {
                            selectedService = this.state.selectedService;
                        }
                        else if (services && services.length > 0) {
                            selectedService = services[0].value;
                        }
                        _a = getMetricTypes(metricDescriptors, this.state.selectedMetricType, getTemplateSrv().replace(this.state.selectedMetricType), getTemplateSrv().replace(selectedService)), metricTypes = _a.metricTypes, selectedMetricType = _a.selectedMetricType;
                        return [4 /*yield*/, this.props.datasource.getSLOServices(this.state.projectName)];
                    case 3:
                        sloServices = _c.sent();
                        _b = [{ services: services, selectedService: selectedService, metricTypes: metricTypes, selectedMetricType: selectedMetricType, metricDescriptors: metricDescriptors, projects: projects }];
                        return [4 /*yield*/, this.getLabels(selectedMetricType, this.state.projectName)];
                    case 4:
                        state = __assign.apply(void 0, [__assign.apply(void 0, _b.concat([(_c.sent())])), { sloServices: sloServices, loading: false }]);
                        this.setState(state, function () { return _this.onPropsChange(); });
                        return [2 /*return*/];
                }
            });
        });
    };
    CloudMonitoringVariableQueryEditor.prototype.onQueryTypeChange = function (queryType) {
        return __awaiter(this, void 0, void 0, function () {
            var state, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = [{ selectedQueryType: queryType }];
                        return [4 /*yield*/, this.getLabels(this.state.selectedMetricType, this.state.projectName, queryType)];
                    case 1:
                        state = __assign.apply(void 0, _a.concat([(_b.sent())]));
                        this.setState(state);
                        return [2 /*return*/];
                }
            });
        });
    };
    CloudMonitoringVariableQueryEditor.prototype.onProjectChange = function (projectName) {
        return __awaiter(this, void 0, void 0, function () {
            var metricDescriptors, labels, _a, metricTypes, selectedMetricType, sloServices;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.props.datasource.getMetricTypes(projectName)];
                    case 1:
                        metricDescriptors = _b.sent();
                        return [4 /*yield*/, this.getLabels(this.state.selectedMetricType, projectName)];
                    case 2:
                        labels = _b.sent();
                        _a = getMetricTypes(metricDescriptors, this.state.selectedMetricType, getTemplateSrv().replace(this.state.selectedMetricType), getTemplateSrv().replace(this.state.selectedService)), metricTypes = _a.metricTypes, selectedMetricType = _a.selectedMetricType;
                        return [4 /*yield*/, this.props.datasource.getSLOServices(projectName)];
                    case 3:
                        sloServices = _b.sent();
                        this.setState(__assign(__assign({}, labels), { metricTypes: metricTypes, selectedMetricType: selectedMetricType, metricDescriptors: metricDescriptors, projectName: projectName, sloServices: sloServices }), function () { return _this.onPropsChange(); });
                        return [2 /*return*/];
                }
            });
        });
    };
    CloudMonitoringVariableQueryEditor.prototype.onServiceChange = function (service) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, metricTypes, selectedMetricType, state, _b;
            var _this = this;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = getMetricTypes(this.state.metricDescriptors, this.state.selectedMetricType, getTemplateSrv().replace(this.state.selectedMetricType), getTemplateSrv().replace(service)), metricTypes = _a.metricTypes, selectedMetricType = _a.selectedMetricType;
                        _b = [{ selectedService: service, metricTypes: metricTypes, selectedMetricType: selectedMetricType }];
                        return [4 /*yield*/, this.getLabels(selectedMetricType, this.state.projectName)];
                    case 1:
                        state = __assign.apply(void 0, _b.concat([(_c.sent())]));
                        this.setState(state, function () { return _this.onPropsChange(); });
                        return [2 /*return*/];
                }
            });
        });
    };
    CloudMonitoringVariableQueryEditor.prototype.onMetricTypeChange = function (metricType) {
        return __awaiter(this, void 0, void 0, function () {
            var state, _a;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = [{ selectedMetricType: metricType }];
                        return [4 /*yield*/, this.getLabels(metricType, this.state.projectName)];
                    case 1:
                        state = __assign.apply(void 0, _a.concat([(_b.sent())]));
                        this.setState(state, function () { return _this.onPropsChange(); });
                        return [2 /*return*/];
                }
            });
        });
    };
    CloudMonitoringVariableQueryEditor.prototype.onLabelKeyChange = function (labelKey) {
        var _this = this;
        this.setState({ labelKey: labelKey }, function () { return _this.onPropsChange(); });
    };
    CloudMonitoringVariableQueryEditor.prototype.componentDidUpdate = function (prevProps, prevState) {
        var selecQueryTypeChanged = prevState.selectedQueryType !== this.state.selectedQueryType;
        var selectSLOServiceChanged = this.state.selectedSLOService !== prevState.selectedSLOService;
        if (selecQueryTypeChanged || selectSLOServiceChanged) {
            this.onPropsChange();
        }
    };
    CloudMonitoringVariableQueryEditor.prototype.getLabels = function (selectedMetricType, projectName, selectedQueryType) {
        if (selectedQueryType === void 0) { selectedQueryType = this.state.selectedQueryType; }
        return __awaiter(this, void 0, void 0, function () {
            var result, labels, labelKey;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        result = { labels: this.state.labels, labelKey: this.state.labelKey };
                        if (!(selectedMetricType && selectedQueryType === MetricFindQueryTypes.LabelValues)) return [3 /*break*/, 2];
                        return [4 /*yield*/, getLabelKeys(this.props.datasource, selectedMetricType, projectName)];
                    case 1:
                        labels = _a.sent();
                        labelKey = labels.some(function (l) { return l === getTemplateSrv().replace(_this.state.labelKey); })
                            ? this.state.labelKey
                            : labels[0];
                        result = { labels: labels, labelKey: labelKey };
                        _a.label = 2;
                    case 2: return [2 /*return*/, result];
                }
            });
        });
    };
    CloudMonitoringVariableQueryEditor.prototype.renderQueryTypeSwitch = function (queryType) {
        var _this = this;
        var variableOptionGroup = {
            label: 'Template Variables',
            expanded: false,
            options: getTemplateSrv()
                .getVariables()
                .map(function (v) { return ({
                value: "$" + v.name,
                label: "$" + v.name,
            }); }),
        };
        switch (queryType) {
            case MetricFindQueryTypes.MetricTypes:
                return (React.createElement(React.Fragment, null,
                    React.createElement(VariableQueryField, { allowCustomValue: true, value: this.state.projectName, options: __spreadArray([variableOptionGroup], __read(this.state.projects), false), onChange: function (value) { return _this.onProjectChange(value); }, label: "Project" }),
                    React.createElement(VariableQueryField, { value: this.state.selectedService, options: __spreadArray([variableOptionGroup], __read(this.state.services), false), onChange: function (value) { return _this.onServiceChange(value); }, label: "Service" })));
            case MetricFindQueryTypes.LabelKeys:
            case MetricFindQueryTypes.LabelValues:
            case MetricFindQueryTypes.ResourceTypes:
                return (React.createElement(React.Fragment, null,
                    React.createElement(VariableQueryField, { allowCustomValue: true, value: this.state.projectName, options: __spreadArray([variableOptionGroup], __read(this.state.projects), false), onChange: function (value) { return _this.onProjectChange(value); }, label: "Project" }),
                    React.createElement(VariableQueryField, { value: this.state.selectedService, options: __spreadArray([variableOptionGroup], __read(this.state.services), false), onChange: function (value) { return _this.onServiceChange(value); }, label: "Service" }),
                    React.createElement(VariableQueryField, { value: this.state.selectedMetricType, options: __spreadArray([
                            variableOptionGroup
                        ], __read(this.state.metricTypes.map(function (_a) {
                            var value = _a.value, name = _a.name;
                            return ({ value: value, label: name });
                        })), false), onChange: function (value) { return _this.onMetricTypeChange(value); }, label: "Metric Type" }),
                    queryType === MetricFindQueryTypes.LabelValues && (React.createElement(VariableQueryField, { value: this.state.labelKey, options: __spreadArray([variableOptionGroup], __read(this.state.labels.map(function (l) { return ({ value: l, label: l }); })), false), onChange: function (value) { return _this.onLabelKeyChange(value); }, label: "Label Key" }))));
            case MetricFindQueryTypes.Aligners:
            case MetricFindQueryTypes.Aggregations:
                return (React.createElement(React.Fragment, null,
                    React.createElement(VariableQueryField, { value: this.state.selectedService, options: __spreadArray([variableOptionGroup], __read(this.state.services), false), onChange: function (value) { return _this.onServiceChange(value); }, label: "Service" }),
                    React.createElement(VariableQueryField, { value: this.state.selectedMetricType, options: __spreadArray([
                            variableOptionGroup
                        ], __read(this.state.metricTypes.map(function (_a) {
                            var value = _a.value, name = _a.name;
                            return ({ value: value, label: name });
                        })), false), onChange: function (value) { return _this.onMetricTypeChange(value); }, label: "Metric Type" })));
            case MetricFindQueryTypes.SLOServices:
                return (React.createElement(React.Fragment, null,
                    React.createElement(VariableQueryField, { allowCustomValue: true, value: this.state.projectName, options: __spreadArray([variableOptionGroup], __read(this.state.projects), false), onChange: function (value) { return _this.onProjectChange(value); }, label: "Project" })));
            case MetricFindQueryTypes.SLO:
                return (React.createElement(React.Fragment, null,
                    React.createElement(VariableQueryField, { allowCustomValue: true, value: this.state.projectName, options: __spreadArray([variableOptionGroup], __read(this.state.projects), false), onChange: function (value) { return _this.onProjectChange(value); }, label: "Project" }),
                    React.createElement(VariableQueryField, { value: this.state.selectedSLOService, options: __spreadArray([variableOptionGroup], __read(this.state.sloServices), false), onChange: function (value) {
                            _this.setState(__assign(__assign({}, _this.state), { selectedSLOService: value }));
                        }, label: "SLO Service" })));
            default:
                return '';
        }
    };
    CloudMonitoringVariableQueryEditor.prototype.render = function () {
        var _this = this;
        if (this.state.loading) {
            return (React.createElement("div", { className: "gf-form max-width-21" },
                React.createElement("span", { className: "gf-form-label width-10 query-keyword" }, "Query Type"),
                React.createElement("div", { className: "gf-form-select-wrapper max-width-12" },
                    React.createElement("select", { className: "gf-form-input" },
                        React.createElement("option", null, "Loading...")))));
        }
        return (React.createElement(React.Fragment, null,
            React.createElement(VariableQueryField, { value: this.state.selectedQueryType, options: this.queryTypes, onChange: function (value) { return _this.onQueryTypeChange(value); }, label: "Query Type" }),
            this.renderQueryTypeSwitch(this.state.selectedQueryType)));
    };
    return CloudMonitoringVariableQueryEditor;
}(PureComponent));
export { CloudMonitoringVariableQueryEditor };
//# sourceMappingURL=VariableQueryEditor.js.map
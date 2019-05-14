import * as tslib_1 from "tslib";
import React from 'react';
import _ from 'lodash';
import appEvents from 'app/core/app_events';
import { MetricSelect } from 'app/core/components/Select/MetricSelect';
var Metrics = /** @class */ (function (_super) {
    tslib_1.__extends(Metrics, _super);
    function Metrics(props) {
        var _this = _super.call(this, props) || this;
        _this.state = {
            metricDescriptors: [],
            metrics: [],
            services: [],
            service: '',
            metric: '',
            metricDescriptor: null,
            defaultProject: '',
        };
        _this.onServiceChange = function (service) {
            var metricDescriptors = _this.state.metricDescriptors;
            var _a = _this.props, templateSrv = _a.templateSrv, metricType = _a.metricType;
            var metrics = metricDescriptors
                .filter(function (m) { return m.service === templateSrv.replace(service); })
                .map(function (m) { return ({
                service: m.service,
                value: m.type,
                label: m.displayName,
                description: m.description,
            }); });
            _this.setState({ service: service, metrics: metrics });
            if (metrics.length > 0 && !metrics.some(function (m) { return m.value === templateSrv.replace(metricType); })) {
                _this.onMetricTypeChange(metrics[0].value);
            }
        };
        _this.onMetricTypeChange = function (value) {
            var metricDescriptor = _this.getSelectedMetricDescriptor(value);
            _this.setState({ metricDescriptor: metricDescriptor });
            _this.props.onChange(tslib_1.__assign({}, metricDescriptor, { type: value }));
        };
        return _this;
    }
    Metrics.prototype.componentDidMount = function () {
        var _this = this;
        this.setState({ defaultProject: this.props.defaultProject }, function () {
            _this.getCurrentProject()
                .then(_this.loadMetricDescriptors.bind(_this))
                .then(_this.initializeServiceAndMetrics.bind(_this));
        });
    };
    Metrics.prototype.getCurrentProject = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var _this = this;
            return tslib_1.__generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve, reject) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                        var defaultProject, error_1;
                        return tslib_1.__generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 3, , 4]);
                                    if (!(!this.state.defaultProject || this.state.defaultProject === 'loading project...')) return [3 /*break*/, 2];
                                    return [4 /*yield*/, this.props.datasource.getDefaultProject()];
                                case 1:
                                    defaultProject = _a.sent();
                                    this.setState({ defaultProject: defaultProject });
                                    _a.label = 2;
                                case 2:
                                    resolve(this.state.defaultProject);
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_1 = _a.sent();
                                    appEvents.emit('ds-request-error', error_1);
                                    reject();
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); })];
            });
        });
    };
    Metrics.prototype.loadMetricDescriptors = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var metricDescriptors;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(this.state.defaultProject !== 'loading project...')) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.props.datasource.getMetricTypes(this.state.defaultProject)];
                    case 1:
                        metricDescriptors = _a.sent();
                        this.setState({ metricDescriptors: metricDescriptors });
                        return [2 /*return*/, metricDescriptors];
                    case 2: return [2 /*return*/, []];
                }
            });
        });
    };
    Metrics.prototype.initializeServiceAndMetrics = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var metricDescriptors, services, metrics, service, metricDescriptor;
            return tslib_1.__generator(this, function (_a) {
                metricDescriptors = this.state.metricDescriptors;
                services = this.getServicesList(metricDescriptors);
                metrics = this.getMetricsList(metricDescriptors);
                service = metrics.length > 0 ? metrics[0].service : '';
                metricDescriptor = this.getSelectedMetricDescriptor(this.props.metricType);
                this.setState({ metricDescriptors: metricDescriptors, services: services, metrics: metrics, service: service, metricDescriptor: metricDescriptor });
                return [2 /*return*/];
            });
        });
    };
    Metrics.prototype.getSelectedMetricDescriptor = function (metricType) {
        var _this = this;
        return this.state.metricDescriptors.find(function (md) { return md.type === _this.props.templateSrv.replace(metricType); });
    };
    Metrics.prototype.getMetricsList = function (metricDescriptors) {
        var selectedMetricDescriptor = this.getSelectedMetricDescriptor(this.props.metricType);
        if (!selectedMetricDescriptor) {
            return [];
        }
        var metricsByService = metricDescriptors
            .filter(function (m) { return m.service === selectedMetricDescriptor.service; })
            .map(function (m) { return ({
            service: m.service,
            value: m.type,
            label: m.displayName,
            description: m.description,
        }); });
        return metricsByService;
    };
    Metrics.prototype.getServicesList = function (metricDescriptors) {
        var services = metricDescriptors.map(function (m) { return ({
            value: m.service,
            label: _.startCase(m.serviceShortName),
        }); });
        return services.length > 0 ? _.uniqBy(services, function (s) { return s.value; }) : [];
    };
    Metrics.prototype.getTemplateVariablesGroup = function () {
        return {
            label: 'Template Variables',
            options: this.props.templateSrv.variables.map(function (v) { return ({
                label: "$" + v.name,
                value: "$" + v.name,
            }); }),
        };
    };
    Metrics.prototype.render = function () {
        var _a = this.state, services = _a.services, service = _a.service, metrics = _a.metrics;
        var _b = this.props, metricType = _b.metricType, templateSrv = _b.templateSrv;
        return (React.createElement(React.Fragment, null,
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement("span", { className: "gf-form-label width-9 query-keyword" }, "Service"),
                    React.createElement(MetricSelect, { onChange: this.onServiceChange, value: service, options: services, isSearchable: false, placeholder: "Select Services", className: "width-15" })),
                React.createElement("div", { className: "gf-form gf-form--grow" },
                    React.createElement("div", { className: "gf-form-label gf-form-label--grow" }))),
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement("span", { className: "gf-form-label width-9 query-keyword" }, "Metric"),
                    React.createElement(MetricSelect, { onChange: this.onMetricTypeChange, value: metricType, variables: templateSrv.variables, options: [
                            {
                                label: 'Metrics',
                                expanded: true,
                                options: metrics,
                            },
                        ], placeholder: "Select Metric", className: "width-26" })),
                React.createElement("div", { className: "gf-form gf-form--grow" },
                    React.createElement("div", { className: "gf-form-label gf-form-label--grow" }))),
            this.props.children(this.state.metricDescriptor)));
    };
    return Metrics;
}(React.Component));
export { Metrics };
//# sourceMappingURL=Metrics.js.map
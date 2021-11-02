import { __assign, __awaiter, __generator, __read, __spreadArray } from "tslib";
import React, { useCallback, useEffect, useState } from 'react';
import { startCase, uniqBy } from 'lodash';
import { Select } from '@grafana/ui';
import { QueryEditorRow, QueryEditorField } from '.';
import { INNER_LABEL_WIDTH, LABEL_WIDTH, SELECT_WIDTH } from '../constants';
export function Metrics(props) {
    var _this = this;
    var _a = __read(useState({
        metricDescriptors: [],
        metrics: [],
        services: [],
        service: '',
        metric: '',
        projectName: null,
    }), 2), state = _a[0], setState = _a[1];
    var services = state.services, service = state.service, metrics = state.metrics, metricDescriptors = state.metricDescriptors;
    var metricType = props.metricType, templateVariableOptions = props.templateVariableOptions, projectName = props.projectName, templateSrv = props.templateSrv, datasource = props.datasource, onChange = props.onChange, children = props.children;
    var getSelectedMetricDescriptor = useCallback(function (metricDescriptors, metricType) {
        return metricDescriptors.find(function (md) { return md.type === templateSrv.replace(metricType); });
    }, [templateSrv]);
    useEffect(function () {
        var getMetricsList = function (metricDescriptors) {
            var selectedMetricDescriptor = getSelectedMetricDescriptor(metricDescriptors, metricType);
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
        var loadMetricDescriptors = function () { return __awaiter(_this, void 0, void 0, function () {
            var metricDescriptors_1, services_1, metrics_1, service_1, metricDescriptor_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!projectName) return [3 /*break*/, 2];
                        return [4 /*yield*/, datasource.getMetricTypes(projectName)];
                    case 1:
                        metricDescriptors_1 = _a.sent();
                        services_1 = getServicesList(metricDescriptors_1);
                        metrics_1 = getMetricsList(metricDescriptors_1);
                        service_1 = metrics_1.length > 0 ? metrics_1[0].service : '';
                        metricDescriptor_1 = getSelectedMetricDescriptor(metricDescriptors_1, metricType);
                        setState(function (prevState) { return (__assign(__assign({}, prevState), { metricDescriptors: metricDescriptors_1, services: services_1, metrics: metrics_1, service: service_1, metricDescriptor: metricDescriptor_1 })); });
                        _a.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        }); };
        loadMetricDescriptors();
    }, [datasource, getSelectedMetricDescriptor, metricType, projectName]);
    var onServiceChange = function (_a) {
        var service = _a.value;
        var metrics = metricDescriptors
            .filter(function (m) { return m.service === templateSrv.replace(service); })
            .map(function (m) { return ({
            service: m.service,
            value: m.type,
            label: m.displayName,
            description: m.description,
        }); });
        if (metrics.length > 0 && !metrics.some(function (m) { return m.value === templateSrv.replace(metricType); })) {
            onMetricTypeChange(metrics[0], { service: service, metrics: metrics });
        }
        else {
            setState(__assign(__assign({}, state), { service: service, metrics: metrics }));
        }
    };
    var onMetricTypeChange = function (_a, extra) {
        var value = _a.value;
        if (extra === void 0) { extra = {}; }
        var metricDescriptor = getSelectedMetricDescriptor(state.metricDescriptors, value);
        setState(__assign(__assign(__assign({}, state), { metricDescriptor: metricDescriptor }), extra));
        onChange(__assign(__assign({}, metricDescriptor), { type: value }));
    };
    var getServicesList = function (metricDescriptors) {
        var services = metricDescriptors.map(function (m) { return ({
            value: m.service,
            label: startCase(m.serviceShortName),
        }); });
        return services.length > 0 ? uniqBy(services, function (s) { return s.value; }) : [];
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(QueryEditorRow, null,
            React.createElement(QueryEditorField, { labelWidth: LABEL_WIDTH, label: "Service" },
                React.createElement(Select, { menuShouldPortal: true, width: SELECT_WIDTH, onChange: onServiceChange, value: __spreadArray(__spreadArray([], __read(services), false), __read(templateVariableOptions), false).find(function (s) { return s.value === service; }), options: __spreadArray([
                        {
                            label: 'Template Variables',
                            options: templateVariableOptions,
                        }
                    ], __read(services), false), placeholder: "Select Services" })),
            React.createElement(QueryEditorField, { label: "Metric name", labelWidth: INNER_LABEL_WIDTH },
                React.createElement(Select, { menuShouldPortal: true, width: SELECT_WIDTH, onChange: onMetricTypeChange, value: __spreadArray(__spreadArray([], __read(metrics), false), __read(templateVariableOptions), false).find(function (s) { return s.value === metricType; }), options: __spreadArray([
                        {
                            label: 'Template Variables',
                            options: templateVariableOptions,
                        }
                    ], __read(metrics), false), placeholder: "Select Metric" }))),
        children(state.metricDescriptor)));
}
//# sourceMappingURL=Metrics.js.map
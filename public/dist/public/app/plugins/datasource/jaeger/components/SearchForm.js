import { __assign, __awaiter, __generator, __read, __spreadArray } from "tslib";
import { css } from '@emotion/css';
import { InlineField, InlineFieldRow, Input, Select } from '@grafana/ui';
import React, { useEffect, useState } from 'react';
import { transformToLogfmt } from '../util';
import { AdvancedOptions } from './AdvancedOptions';
export var ALL_OPERATIONS_KEY = 'All';
var allOperationsOption = {
    label: ALL_OPERATIONS_KEY,
    value: undefined,
};
export function SearchForm(_a) {
    var _this = this;
    var datasource = _a.datasource, query = _a.query, onChange = _a.onChange;
    var _b = __read(useState(), 2), serviceOptions = _b[0], setServiceOptions = _b[1];
    var _c = __read(useState(), 2), operationOptions = _c[0], setOperationOptions = _c[1];
    useEffect(function () {
        var getServices = function () { return __awaiter(_this, void 0, void 0, function () {
            var services;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, loadServices({
                            dataSource: datasource,
                            url: '/api/services',
                            notFoundLabel: 'No service found',
                        })];
                    case 1:
                        services = _a.sent();
                        setServiceOptions(services);
                        return [2 /*return*/];
                }
            });
        }); };
        getServices();
    }, [datasource]);
    useEffect(function () {
        var getOperations = function () { return __awaiter(_this, void 0, void 0, function () {
            var operations;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, loadServices({
                            dataSource: datasource,
                            url: "/api/services/" + encodeURIComponent(query.service) + "/operations",
                            notFoundLabel: 'No operation found',
                        })];
                    case 1:
                        operations = _a.sent();
                        setOperationOptions(__spreadArray([allOperationsOption], __read(operations), false));
                        return [2 /*return*/];
                }
            });
        }); };
        if (query.service) {
            getOperations();
        }
    }, [datasource, query.service]);
    return (React.createElement("div", { className: css({ maxWidth: '500px' }) },
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Service", labelWidth: 14, grow: true },
                React.createElement(Select, { menuShouldPortal: true, options: serviceOptions, value: (serviceOptions === null || serviceOptions === void 0 ? void 0 : serviceOptions.find(function (v) { return v.value === query.service; })) || null, onChange: function (v) {
                        onChange(__assign(__assign({}, query), { service: v.value, operation: query.service !== v.value ? undefined : query.operation }));
                    }, menuPlacement: "bottom", isClearable: true }))),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Operation", labelWidth: 14, grow: true, disabled: !query.service },
                React.createElement(Select, { menuShouldPortal: true, options: operationOptions, value: (operationOptions === null || operationOptions === void 0 ? void 0 : operationOptions.find(function (v) { return v.value === query.operation; })) || null, onChange: function (v) {
                        return onChange(__assign(__assign({}, query), { operation: v.value }));
                    }, menuPlacement: "bottom", isClearable: true }))),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Tags", labelWidth: 14, grow: true },
                React.createElement(Input, { value: transformToLogfmt(query.tags), placeholder: "http.status_code=200 error=true", onChange: function (v) {
                        return onChange(__assign(__assign({}, query), { tags: v.currentTarget.value }));
                    } }))),
        React.createElement(AdvancedOptions, { query: query, onChange: onChange })));
}
var loadServices = function (_a) {
    var dataSource = _a.dataSource, url = _a.url, notFoundLabel = _a.notFoundLabel;
    return __awaiter(void 0, void 0, void 0, function () {
        var services, serviceOptions;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, dataSource.metadataRequest(url)];
                case 1:
                    services = _b.sent();
                    if (!services) {
                        return [2 /*return*/, [{ label: notFoundLabel, value: notFoundLabel }]];
                    }
                    serviceOptions = services.sort().map(function (service) { return ({
                        label: service,
                        value: service,
                    }); });
                    return [2 /*return*/, serviceOptions];
            }
        });
    });
};
//# sourceMappingURL=SearchForm.js.map
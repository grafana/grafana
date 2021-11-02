import { __assign, __read, __spreadArray } from "tslib";
import React, { useEffect, useState } from 'react';
import { Select } from '@grafana/ui';
import { QueryEditorRow } from '..';
import { SELECT_WIDTH } from '../../constants';
export var Service = function (_a) {
    var query = _a.query, templateVariableOptions = _a.templateVariableOptions, onChange = _a.onChange, datasource = _a.datasource;
    var _b = __read(useState([]), 2), services = _b[0], setServices = _b[1];
    var projectName = query.projectName;
    useEffect(function () {
        if (!projectName) {
            return;
        }
        datasource.getSLOServices(projectName).then(function (services) {
            setServices(__spreadArray([
                {
                    label: 'Template Variables',
                    options: templateVariableOptions,
                }
            ], __read(services), false));
        });
    }, [datasource, projectName, templateVariableOptions]);
    return (React.createElement(QueryEditorRow, { label: "Service" },
        React.createElement(Select, { menuShouldPortal: true, width: SELECT_WIDTH, allowCustomValue: true, value: (query === null || query === void 0 ? void 0 : query.serviceId) && { value: query === null || query === void 0 ? void 0 : query.serviceId, label: (query === null || query === void 0 ? void 0 : query.serviceName) || (query === null || query === void 0 ? void 0 : query.serviceId) }, placeholder: "Select service", options: services, onChange: function (_a) {
                var _b = _a.value, serviceId = _b === void 0 ? '' : _b, _c = _a.label, serviceName = _c === void 0 ? '' : _c;
                return onChange(__assign(__assign({}, query), { serviceId: serviceId, serviceName: serviceName, sloId: '' }));
            } })));
};
//# sourceMappingURL=Service.js.map
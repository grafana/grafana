import { __assign, __awaiter, __generator, __read, __spreadArray } from "tslib";
import React, { useEffect, useState } from 'react';
import { Select } from '@grafana/ui';
import { QueryEditorRow } from '..';
import { SELECT_WIDTH } from '../../constants';
export var SLO = function (_a) {
    var query = _a.query, templateVariableOptions = _a.templateVariableOptions, onChange = _a.onChange, datasource = _a.datasource;
    var _b = __read(useState([]), 2), slos = _b[0], setSLOs = _b[1];
    var projectName = query.projectName, serviceId = query.serviceId;
    useEffect(function () {
        if (!projectName || !serviceId) {
            return;
        }
        datasource.getServiceLevelObjectives(projectName, serviceId).then(function (sloIds) {
            setSLOs(__spreadArray([
                {
                    label: 'Template Variables',
                    options: templateVariableOptions,
                }
            ], __read(sloIds), false));
        });
    }, [datasource, projectName, serviceId, templateVariableOptions]);
    return (React.createElement(QueryEditorRow, { label: "SLO" },
        React.createElement(Select, { menuShouldPortal: true, width: SELECT_WIDTH, allowCustomValue: true, value: (query === null || query === void 0 ? void 0 : query.sloId) && { value: query === null || query === void 0 ? void 0 : query.sloId, label: (query === null || query === void 0 ? void 0 : query.sloName) || (query === null || query === void 0 ? void 0 : query.sloId) }, placeholder: "Select SLO", options: slos, onChange: function (_a) {
                var _b = _a.value, sloId = _b === void 0 ? '' : _b, _c = _a.label, sloName = _c === void 0 ? '' : _c;
                return __awaiter(void 0, void 0, void 0, function () {
                    var slos, slo;
                    return __generator(this, function (_d) {
                        switch (_d.label) {
                            case 0: return [4 /*yield*/, datasource.getServiceLevelObjectives(projectName, serviceId)];
                            case 1:
                                slos = _d.sent();
                                slo = slos.find(function (_a) {
                                    var value = _a.value;
                                    return value === datasource.templateSrv.replace(sloId);
                                });
                                onChange(__assign(__assign({}, query), { sloId: sloId, sloName: sloName, goal: slo === null || slo === void 0 ? void 0 : slo.goal }));
                                return [2 /*return*/];
                        }
                    });
                });
            } })));
};
//# sourceMappingURL=SLO.js.map
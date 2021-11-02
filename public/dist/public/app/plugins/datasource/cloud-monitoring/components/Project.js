import { __read, __spreadArray } from "tslib";
import React, { useEffect, useState } from 'react';
import { Select } from '@grafana/ui';
import { SELECT_WIDTH } from '../constants';
import { QueryEditorRow } from '.';
export function Project(_a) {
    var projectName = _a.projectName, datasource = _a.datasource, onChange = _a.onChange, templateVariableOptions = _a.templateVariableOptions;
    var _b = __read(useState([]), 2), projects = _b[0], setProjects = _b[1];
    useEffect(function () {
        datasource.getProjects().then(function (projects) {
            return setProjects(__spreadArray([
                {
                    label: 'Template Variables',
                    options: templateVariableOptions,
                }
            ], __read(projects), false));
        });
    }, [datasource, templateVariableOptions]);
    return (React.createElement(QueryEditorRow, { label: "Project" },
        React.createElement(Select, { menuShouldPortal: true, width: SELECT_WIDTH, allowCustomValue: true, formatCreateLabel: function (v) { return "Use project: " + v; }, onChange: function (_a) {
                var value = _a.value;
                return onChange(value);
            }, options: projects, value: { value: projectName, label: projectName }, placeholder: "Select Project" })));
}
//# sourceMappingURL=Project.js.map
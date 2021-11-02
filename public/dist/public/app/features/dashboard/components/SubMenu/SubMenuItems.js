import { __read } from "tslib";
import React, { useEffect, useState } from 'react';
import { VariableHide } from '../../../variables/types';
import { selectors } from '@grafana/e2e-selectors';
import { PickerRenderer } from '../../../variables/pickers/PickerRenderer';
export var SubMenuItems = function (_a) {
    var variables = _a.variables;
    var _b = __read(useState([]), 2), visibleVariables = _b[0], setVisibleVariables = _b[1];
    useEffect(function () {
        setVisibleVariables(variables.filter(function (state) { return state.hide !== VariableHide.hideVariable; }));
    }, [variables]);
    if (visibleVariables.length === 0) {
        return null;
    }
    return (React.createElement(React.Fragment, null, visibleVariables.map(function (variable) {
        return (React.createElement("div", { key: variable.id, className: "submenu-item gf-form-inline", "data-testid": selectors.pages.Dashboard.SubMenu.submenuItem },
            React.createElement(PickerRenderer, { variable: variable })));
    })));
};
//# sourceMappingURL=SubMenuItems.js.map
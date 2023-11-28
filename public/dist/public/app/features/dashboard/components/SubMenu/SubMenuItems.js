import React, { useEffect, useState } from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { PickerRenderer } from '../../../variables/pickers/PickerRenderer';
import { VariableHide } from '../../../variables/types';
export const SubMenuItems = ({ variables, readOnly }) => {
    const [visibleVariables, setVisibleVariables] = useState([]);
    useEffect(() => {
        setVisibleVariables(variables.filter((state) => state.hide !== VariableHide.hideVariable));
    }, [variables]);
    if (visibleVariables.length === 0) {
        return null;
    }
    return (React.createElement(React.Fragment, null, visibleVariables.map((variable) => {
        return (React.createElement("div", { key: variable.id, className: "submenu-item gf-form-inline", "data-testid": selectors.pages.Dashboard.SubMenu.submenuItem },
            React.createElement(PickerRenderer, { variable: variable, readOnly: readOnly })));
    })));
};
//# sourceMappingURL=SubMenuItems.js.map
import React, { useMemo } from 'react';
import { VariableHide } from '../types';
import { selectors } from '@grafana/e2e-selectors';
import { variableAdapters } from '../adapters';
import { Tooltip } from '@grafana/ui';
export var PickerRenderer = function (props) {
    var PickerToRender = useMemo(function () { return variableAdapters.get(props.variable.type).picker; }, [props.variable]);
    if (!props.variable) {
        return React.createElement("div", null, "Couldn't load variable");
    }
    return (React.createElement("div", { className: "gf-form" },
        React.createElement(PickerLabel, { variable: props.variable }),
        props.variable.hide !== VariableHide.hideVariable && PickerToRender && (React.createElement(PickerToRender, { variable: props.variable }))));
};
function PickerLabel(_a) {
    var variable = _a.variable;
    var labelOrName = useMemo(function () { return variable.label || variable.name; }, [variable]);
    if (variable.hide !== VariableHide.dontHide) {
        return null;
    }
    if (variable.description) {
        return (React.createElement(Tooltip, { content: variable.description, placement: 'bottom' },
            React.createElement("label", { className: "gf-form-label gf-form-label--variable", "data-testid": selectors.pages.Dashboard.SubMenu.submenuItemLabels(labelOrName), htmlFor: variable.id }, labelOrName)));
    }
    return (React.createElement("label", { className: "gf-form-label gf-form-label--variable", "data-testid": selectors.pages.Dashboard.SubMenu.submenuItemLabels(labelOrName), htmlFor: variable.id }, labelOrName));
}
//# sourceMappingURL=PickerRenderer.js.map
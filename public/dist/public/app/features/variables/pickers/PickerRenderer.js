import React, { useMemo } from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { Tooltip } from '@grafana/ui';
import { variableAdapters } from '../adapters';
import { VARIABLE_PREFIX } from '../constants';
import { VariableHide } from '../types';
export const PickerRenderer = (props) => {
    var _a;
    const PickerToRender = useMemo(() => variableAdapters.get(props.variable.type).picker, [props.variable]);
    if (!props.variable) {
        return React.createElement("div", null, "Couldn't load variable");
    }
    return (React.createElement("div", { className: "gf-form" },
        React.createElement(PickerLabel, { variable: props.variable }),
        props.variable.hide !== VariableHide.hideVariable && PickerToRender && (React.createElement(PickerToRender, { variable: props.variable, readOnly: (_a = props.readOnly) !== null && _a !== void 0 ? _a : false }))));
};
function PickerLabel({ variable }) {
    const labelOrName = useMemo(() => variable.label || variable.name, [variable]);
    if (variable.hide !== VariableHide.dontHide) {
        return null;
    }
    const elementId = VARIABLE_PREFIX + variable.id;
    if (variable.description) {
        return (React.createElement(Tooltip, { content: variable.description, placement: 'bottom' },
            React.createElement("label", { className: "gf-form-label gf-form-label--variable", "data-testid": selectors.pages.Dashboard.SubMenu.submenuItemLabels(labelOrName), htmlFor: elementId }, labelOrName)));
    }
    return (React.createElement("label", { className: "gf-form-label gf-form-label--variable", "data-testid": selectors.pages.Dashboard.SubMenu.submenuItemLabels(labelOrName), htmlFor: elementId }, labelOrName));
}
//# sourceMappingURL=PickerRenderer.js.map
import { __makeTemplateObject } from "tslib";
import React from 'react';
import { InlineFormLabel, Select, useStyles } from '@grafana/ui';
import { css } from '@emotion/css';
export function VariableSelectField(_a) {
    var name = _a.name, value = _a.value, options = _a.options, tooltip = _a.tooltip, onChange = _a.onChange, ariaLabel = _a.ariaLabel, width = _a.width, labelWidth = _a.labelWidth;
    var styles = useStyles(getStyles);
    var inputId = "variable-select-input-" + name;
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineFormLabel, { width: labelWidth !== null && labelWidth !== void 0 ? labelWidth : 6, tooltip: tooltip, htmlFor: inputId }, name),
        React.createElement("div", { "aria-label": ariaLabel },
            React.createElement(Select, { inputId: inputId, menuShouldPortal: true, onChange: onChange, value: value, width: width !== null && width !== void 0 ? width : 25, options: options, className: styles.selectContainer }))));
}
function getStyles(theme) {
    return {
        selectContainer: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      margin-right: ", ";\n    "], ["\n      margin-right: ", ";\n    "])), theme.spacing.xs),
    };
}
var templateObject_1;
//# sourceMappingURL=VariableSelectField.js.map